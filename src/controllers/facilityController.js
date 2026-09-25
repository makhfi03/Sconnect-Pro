import { pool } from '../config/db.js';

export class FacilityController {
  static async getAll(req, res) {
    try {
      const result = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur serveur lors de la récupération des équipements' }));
    }
  }
}