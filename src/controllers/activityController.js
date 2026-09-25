import { pool } from '../config/db.js';

export class ActivityController {
  static async getAll(req, res) {
    try {
      const query = `
        SELECT a.*, f.name AS facility_name, ass.name AS association_name,
               (a.max_capacity - COUNT(r.id)) AS remaining_seats
        FROM activities a
        LEFT JOIN facilities f ON a.facility_id = f.id
        LEFT JOIN associations ass ON a.association_id = ass.id
        LEFT JOIN registrations r ON a.id = r.activity_id AND r.status = 'confirmed'
        GROUP BY a.id, f.name, ass.name
        ORDER BY a.title ASC;
      `;
      const result = await pool.query(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération du catalogue d\'activités' }));
    }
  }
}