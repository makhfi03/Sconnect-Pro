import { pool } from '../config/db.js';

export class HomeController {
  static async getStats(req, res) {
    try {
      const stats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM members) AS total_members,
          (SELECT COUNT(*) FROM activities) AS total_activities,
          (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed') AS total_registrations,
          (SELECT COUNT(*) FROM waiting_list WHERE status = 'waiting') AS total_waiting
      `);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats.rows[0]));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération des statistiques' }));
    }
  }
}