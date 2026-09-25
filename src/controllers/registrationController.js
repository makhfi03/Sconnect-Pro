import { pool } from '../config/db.js';
import { EligibilityService } from '../services/eligibilityService.js';
import { PricingService } from '../services/pricingService.js';
import { ScheduleService } from '../services/scheduleService.js';
import { WaitingListService } from '../services/waitingListService.js';

export class RegistrationController {
  static async create(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      const client = await pool.connect();
      try {
        const { member_id, activity_id } = JSON.parse(body);

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
          return res.end(JSON.stringify({ error: eligibility.reason }));
        }

        const scheduleCheck = await ScheduleService.checkScheduleConflict(member_id, activity);
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
            INSERT INTO waiting_list (activity_id, member_id, priority_score, status)
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

        const finalPrice = PricingService.calculateFinalPrice(
          member, 
          { quotient_familial: member.quotient_familial }, 
          activity, 
          siblingCount
        );

        const newRegistration = await client.query(`
          INSERT INTO registrations (member_id, activity_id, final_price, status)
          VALUES ($1, $2, $3, 'confirmed')
          RETURNING *;
        `, [member_id, activity_id, finalPrice]);

        await client.query('COMMIT');

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'SUCCESS',
          registration: newRegistration.rows[0]
        }));

      } catch (error) {
        await client.query('ROLLBACK');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors de la procédure d\'inscription', details: error.message }));
      } finally {
        client.release();
      }
    });
  }
}