import { pool } from '../config/db.js';

export class HomeController {
  static async getStats(req, res) {
    try {
      const stats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM members) AS total_members,
          (SELECT COUNT(*) FROM activities) AS total_activities,
          (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed') AS total_registrations,
          (SELECT COUNT(*) FROM waiting_list WHERE status = 'waiting') AS total_waiting,
          (SELECT COALESCE(SUM(final_price), 0) FROM registrations WHERE status = 'confirmed') AS total_revenue
      `);

      const fillRateRes = await pool.query(`
        SELECT 
          COALESCE(AVG(fill_rate), 0) AS avg_fill_rate
        FROM (
          SELECT 
            a.id,
            CASE WHEN a.max_capacity > 0 
              THEN (COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::float / a.max_capacity) * 100
              ELSE 0
            END AS fill_rate
          FROM activities a
          LEFT JOIN registrations r ON a.id = r.activity_id
          GROUP BY a.id, a.max_capacity
        ) sub
      `);

      const topActivitiesRes = await pool.query(`
        SELECT 
          a.id, a.title, a.max_capacity,
          COUNT(r.id) FILTER (WHERE r.status = 'confirmed') AS confirmed_count,
          CASE WHEN a.max_capacity > 0
            THEN ROUND((COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::numeric / a.max_capacity) * 100, 1)
            ELSE 0
          END AS fill_rate_percent
        FROM activities a
        LEFT JOIN registrations r ON a.id = r.activity_id
        GROUP BY a.id, a.title, a.max_capacity
        ORDER BY fill_rate_percent DESC
        LIMIT 5
      `);

      const revenueByActivityRes = await pool.query(`
        SELECT 
          a.title,
          COUNT(r.id) AS registration_count,
          COALESCE(SUM(r.final_price), 0) AS revenue
        FROM activities a
        LEFT JOIN registrations r ON a.id = r.activity_id AND r.status = 'confirmed'
        GROUP BY a.id, a.title
        ORDER BY revenue DESC
      `);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        overview: stats.rows[0],
        avg_fill_rate: parseFloat(parseFloat(fillRateRes.rows[0].avg_fill_rate).toFixed(1)),
        top_activities: topActivitiesRes.rows,
        revenue_by_activity: revenueByActivityRes.rows
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération des statistiques' }));
    }
  }
}