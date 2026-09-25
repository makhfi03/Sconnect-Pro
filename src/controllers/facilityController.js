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

  static async create(req, res) {
    try {
      const { name, capacity, sub_zone = null } = req.body;

      if (!name || !capacity) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Le nom et la capacité ERP sont obligatoires.' }));
      }

      const query = `
        INSERT INTO facilities (name, capacity, sub_zone)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const result = await pool.query(query, [name, capacity, sub_zone]);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Équipement créé avec succès',
        facility: result.rows[0]
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la création de l\'équipement', details: error.message }));
    }
  }
}