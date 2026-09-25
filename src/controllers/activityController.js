import { pool } from '../config/db.js';
import { ScheduleService } from '../services/scheduleService.js';

export class ActivityController {
  static async getAll(req, res) {
    try {
      const query = `
        SELECT a.*, f.name AS facility_name, ass.name AS association_name,
               (a.max_capacity - COUNT(r.id) FILTER (WHERE r.status = 'confirmed')) AS remaining_seats
        FROM activities a
        LEFT JOIN facilities f ON a.facility_id = f.id
        LEFT JOIN associations ass ON a.association_id = ass.id
        LEFT JOIN registrations r ON a.id = r.activity_id
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

  static async getById(req, res) {
    try {
      const id = req.params?.id;
      const query = `
        SELECT a.*, f.name AS facility_name, f.capacity AS facility_capacity, f.sub_zone,
               ass.name AS association_name,
               (a.max_capacity - COUNT(r.id) FILTER (WHERE r.status = 'confirmed')) AS remaining_seats
        FROM activities a
        LEFT JOIN facilities f ON a.facility_id = f.id
        LEFT JOIN associations ass ON a.association_id = ass.id
        LEFT JOIN registrations r ON a.id = r.activity_id
        WHERE a.id = $1
        GROUP BY a.id, f.name, f.capacity, f.sub_zone, ass.name;
      `;
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Activité non trouvée' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0]));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la récupération de l\'activité' }));
    }
  }

  static async create(req, res) {
    try {
      const {
        association_id,
        facility_id,
        title,
        base_price,
        max_capacity,
        day_of_week,
        start_time,
        end_time,
        min_age = 0,
        max_age = 99,
        is_high_risk_sport = false
      } = req.body;

      if (!facility_id || !title || !base_price || !max_capacity || !day_of_week || !start_time || !end_time) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Tous les champs obligatoires doivent être renseignés.' }));
      }

      const erpCheck = await ScheduleService.checkErpCapacity(facility_id, max_capacity);
      if (!erpCheck.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: erpCheck.reason }));
      }

      const collisionCheck = await ScheduleService.checkFacilityCollision(
        facility_id,
        parseInt(day_of_week, 10),
        start_time,
        end_time
      );

      if (collisionCheck.hasCollision) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: `Conflit d'occupation de salle : le créneau chevauche l'activité "${collisionCheck.conflictingActivity}" (${collisionCheck.startTime} - ${collisionCheck.endTime})`
        }));
      }

      const insertQuery = `
        INSERT INTO activities (
          association_id, facility_id, title, base_price, max_capacity,
          day_of_week, start_time, end_time, min_age, max_age, is_high_risk_sport
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;

      const result = await pool.query(insertQuery, [
        association_id,
        facility_id,
        title,
        base_price,
        max_capacity,
        day_of_week,
        start_time,
        end_time,
        min_age,
        max_age,
        is_high_risk_sport
      ]);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Activité créée avec succès',
        activity: result.rows[0]
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la création de l\'activité', details: error.message }));
    }
  }
}