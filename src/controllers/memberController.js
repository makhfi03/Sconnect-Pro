import { pool } from '../config/db.js';

export class MemberController {
  static async getAll(req, res) {
    try {
      const query = `
        SELECT m.*, f.family_code, f.quotient_familial 
        FROM members m
        LEFT JOIN families f ON m.family_id = f.id
        ORDER BY m.lastname ASC, m.firstname ASC;
      `;
      const result = await pool.query(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération des membres' }));
    }
  }
}