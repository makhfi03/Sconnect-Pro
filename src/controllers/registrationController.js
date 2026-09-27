import { pool } from '../config/db.js';
import { EligibilityService } from '../services/eligibilityService.js';
import { PricingService } from '../services/pricingService.js';
import { ScheduleService } from '../services/scheduleService.js';
import { WaitingListService } from '../services/waitingListService.js';

export class RegistrationController {
  static async quote(req, res) {
    try {
      const { member_id, activity_id } = req.body;

      if (!member_id || !activity_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'member_id et activity_id sont obligatoires.' }));
      }

      const memberRes = await pool.query(`
        SELECT m.*, f.quotient_familial 
        FROM members m 
        LEFT JOIN families f ON m.family_id = f.id 
        WHERE m.id = $1
      `, [member_id]);

      if (memberRes.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Membre non trouvé' }));
      }
      const member = memberRes.rows[0];

      const activityRes = await pool.query('SELECT * FROM activities WHERE id = $1', [activity_id]);
      if (activityRes.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Activité non trouvée' }));
      }
      const activity = activityRes.rows[0];

      const eligibility = EligibilityService.validateMemberForActivity(member, activity);
      if (!eligibility.eligible) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: eligibility.reason, status: eligibility.status }));
      }

      const siblingsRes = await pool.query(
        "SELECT COUNT(*) FROM registrations r JOIN members m ON r.member_id = m.id WHERE m.family_id = $1 AND r.activity_id = $2 AND r.status = 'confirmed'",
        [member.family_id, activity_id]
      );
      const siblingCount = parseInt(siblingsRes.rows[0].count);

      const quote = PricingService.generateQuote(
        member,
        { quotient_familial: member.quotient_familial },
        activity,
        siblingCount
      );

      const schedule = PricingService.generatePaymentSchedule(quote.finalPrice, 3);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        member: { id: member.id, firstname: member.firstname, lastname: member.lastname },
        activity: { id: activity.id, title: activity.title },
        federal_category: eligibility.category,
        quote,
        paymentSchedule: schedule
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors du calcul du devis', details: error.message }));
    }
  }

  static async create(req, res) {
    const client = await pool.connect();
    try {
      const { member_id, activity_id, installments = 1 } = req.body;

      if (!member_id || !activity_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'member_id et activity_id sont obligatoires.' }));
      }

      const memberRes = await client.query(`
        SELECT m.*, f.quotient_familial 
        FROM members m 
        LEFT JOIN families f ON m.family_id = f.id 
        WHERE m.id = $1
      `, [member_id]);

      if (memberRes.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Membre non trouvé' }));
      }
      const member = memberRes.rows[0];

      const activityRes = await client.query('SELECT * FROM activities WHERE id = $1', [activity_id]);
      if (activityRes.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Activité non trouvée' }));
      }
      const activity = activityRes.rows[0];

      const eligibility = EligibilityService.validateMemberForActivity(member, activity);
      if (!eligibility.eligible) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: eligibility.reason,
          status: eligibility.status || 'ineligible',
          category: eligibility.category
        }));
      }

      const scheduleCheck = await ScheduleService.checkMemberScheduleConflict(
        member_id,
        activity.day_of_week,
        activity.start_time,
        activity.end_time
      );
      if (scheduleCheck.hasConflict) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: `Chevauchement d'horaire avec l'activité : ${scheduleCheck.conflictingActivity}`
        }));
      }

      await client.query('BEGIN');

      const actLock = await client.query(
        'SELECT max_capacity FROM activities WHERE id = $1 FOR UPDATE',
        [activity_id]
      );
      const maxCapacity = actLock.rows[0].max_capacity;

      const countRes = await client.query(
        "SELECT COUNT(*) FROM registrations WHERE activity_id = $1 AND status = 'confirmed'",
        [activity_id]
      );
      const currentRegistrations = parseInt(countRes.rows[0].count);

      if (currentRegistrations >= maxCapacity) {
        const priorityScore = WaitingListService.calculatePriorityScore(member, { quotient_familial: member.quotient_familial });

        await client.query(`
          INSERT INTO waiting_list (activity_id, member_id, score, status)
          VALUES ($1, $2, $3, 'waiting')
        `, [activity_id, member_id, priorityScore]);

        await client.query('COMMIT');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'WAITING_LIST',
          message: 'Créneau complet. Membre ajouté à la liste d\'attente prioritaire.',
          priority_score: priorityScore
        }));
      }

      const siblingsRes = await client.query(
        "SELECT COUNT(*) FROM registrations r JOIN members m ON r.member_id = m.id WHERE m.family_id = $1 AND r.activity_id = $2 AND r.status = 'confirmed'",
        [member.family_id, activity_id]
      );
      const siblingCount = parseInt(siblingsRes.rows[0].count);

      const quote = PricingService.generateQuote(
        member,
        { quotient_familial: member.quotient_familial },
        activity,
        siblingCount
      );

      const newRegistration = await client.query(`
        INSERT INTO registrations (member_id, activity_id, final_price, status)
        VALUES ($1, $2, $3, 'confirmed')
        RETURNING *;
      `, [member_id, activity_id, quote.finalPrice]);

      await client.query('COMMIT');

      const paymentSchedule = PricingService.generatePaymentSchedule(quote.finalPrice, installments);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'SUCCESS',
        registration: newRegistration.rows[0],
        federal_category: eligibility.category,
        quote,
        paymentSchedule
      }));

    } catch (error) {
      await client.query('ROLLBACK');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de la procédure d\'inscription', details: error.message }));
    } finally {
      client.release();
    }
  }

  static async cancel(req, res) {
    const client = await pool.connect();
    try {
      const id = req.params?.id;

      await client.query('BEGIN');

      const regRes = await client.query(
        'SELECT * FROM registrations WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (regRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Inscription non trouvée' }));
      }

      const registration = regRes.rows[0];

      await client.query(
        "UPDATE registrations SET status = 'cancelled' WHERE id = $1",
        [id]
      );

      const promoted = await WaitingListService.promoteNextInLine(registration.activity_id, client);

      await client.query('COMMIT');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'CANCELLED',
        message: 'Inscription annulée avec succès.',
        promoted: promoted ? { member_id: promoted.member_id, deadline: promoted.confirmation_deadline } : null
      }));
    } catch (error) {
      await client.query('ROLLBACK');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur lors de l\'annulation', details: error.message }));
    } finally {
      client.release();
    }
  }
}