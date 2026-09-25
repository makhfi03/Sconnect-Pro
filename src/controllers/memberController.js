import { pool } from '../config/db.js';
import { EligibilityService } from '../services/eligibilityService.js';

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

      const members = result.rows.map(m => {
        const federalAge = EligibilityService.calculateFederalAge(m.birth_date);
        const category = EligibilityService.getFederalCategory(federalAge);
        return { ...m, federal_age: federalAge, federal_category: category };
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(members));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération des membres' }));
    }
  }

  static async getById(req, res) {
    try {
      const id = req.params?.id;
      const query = `
        SELECT m.*, f.family_code, f.quotient_familial 
        FROM members m
        LEFT JOIN families f ON m.family_id = f.id
        WHERE m.id = $1;
      `;
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Membre non trouvé' }));
      }

      const m = result.rows[0];
      const federalAge = EligibilityService.calculateFederalAge(m.birth_date);
      const category = EligibilityService.getFederalCategory(federalAge);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...m, federal_age: federalAge, federal_category: category }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération du membre' }));
    }
  }

  static async create(req, res) {
    try {
      const {
        family_id,
        firstname,
        lastname,
        birth_date,
        is_resident = true,
        cert_medical_date,
        passport_code = null
      } = req.body;

      if (!firstname || !lastname || !birth_date || !cert_medical_date) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Nom, prénom, date de naissance et date du certificat médical sont obligatoires.' }));
      }

      const query = `
        INSERT INTO members (family_id, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const result = await pool.query(query, [
        family_id || null, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code
      ]);

      const member = result.rows[0];
      const federalAge = EligibilityService.calculateFederalAge(member.birth_date);
      const category = EligibilityService.getFederalCategory(federalAge);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Adhérent créé avec succès',
        member: { ...member, federal_age: federalAge, federal_category: category }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la création de l\'adhérent', details: error.message }));
    }
  }

  static async update(req, res) {
    try {
      const id = req.params?.id;
      const {
        family_id,
        firstname,
        lastname,
        birth_date,
        is_resident,
        cert_medical_date,
        passport_code
      } = req.body;

      const query = `
        UPDATE members SET
          family_id = COALESCE($1, family_id),
          firstname = COALESCE($2, firstname),
          lastname = COALESCE($3, lastname),
          birth_date = COALESCE($4, birth_date),
          is_resident = COALESCE($5, is_resident),
          cert_medical_date = COALESCE($6, cert_medical_date),
          passport_code = COALESCE($7, passport_code)
        WHERE id = $8
        RETURNING *;
      `;
      const result = await pool.query(query, [
        family_id, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code, id
      ]);

      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Membre non trouvé' }));
      }

      const member = result.rows[0];
      const federalAge = EligibilityService.calculateFederalAge(member.birth_date);
      const category = EligibilityService.getFederalCategory(federalAge);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Adhérent mis à jour avec succès',
        member: { ...member, federal_age: federalAge, federal_category: category }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la mise à jour de l\'adhérent', details: error.message }));
    }
  }
}