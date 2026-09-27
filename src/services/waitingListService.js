import { pool } from '../config/db.js';
import { PricingService } from './pricingService.js';

export class WaitingListService {
  static calculatePriorityScore(member, family) {
    let score = 0;

    if (member.is_resident) {
      score += 50;
    }

    if (family && parseFloat(family.quotient_familial) < 600) {
      score += 20;
    }

    return score;
  }

  static async promoteNextInLine(activityId, client = pool) {
    const selectQuery = `
      SELECT id, member_id 
      FROM waiting_list 
      WHERE activity_id = $1 AND status = 'waiting'
      ORDER BY score DESC, created_at ASC
      LIMIT 1
      FOR UPDATE;
    `;

    const { rows } = await client.query(selectQuery, [activityId]);

    if (rows.length === 0) {
      return null;
    }

    const nextInLine = rows[0];

    const updateQuery = `
      UPDATE waiting_list 
      SET status = 'promoted_pending',
          promoted_at = CURRENT_TIMESTAMP,
          confirmation_deadline = CURRENT_TIMESTAMP + INTERVAL '48 hours'
      WHERE id = $1
      RETURNING *;
    `;

    const { rows: updatedRows } = await client.query(updateQuery, [nextInLine.id]);
    return updatedRows[0];
  }

  static async expireOverduePromotions() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expiredRes = await client.query(`
        SELECT id, activity_id, member_id
        FROM waiting_list
        WHERE status = 'promoted_pending'
          AND confirmation_deadline < CURRENT_TIMESTAMP
        FOR UPDATE;
      `);

      const results = [];

      for (const entry of expiredRes.rows) {
        await client.query(
          "UPDATE waiting_list SET status = 'expired' WHERE id = $1",
          [entry.id]
        );

        const promoted = await this.promoteNextInLine(entry.activity_id, client);
        results.push({
          expired_member_id: entry.member_id,
          activity_id: entry.activity_id,
          promoted: promoted ? promoted.member_id : null
        });
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async confirmPromotion(waitingListId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wlRes = await client.query(
        "SELECT * FROM waiting_list WHERE id = $1 AND status = 'promoted_pending' FOR UPDATE",
        [waitingListId]
      );

      if (wlRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, reason: 'Entrée non trouvée ou promotion expirée.' };
      }

      const entry = wlRes.rows[0];

      if (entry.confirmation_deadline && new Date(entry.confirmation_deadline) < new Date()) {
        await client.query(
          "UPDATE waiting_list SET status = 'expired' WHERE id = $1",
          [waitingListId]
        );
        await this.promoteNextInLine(entry.activity_id, client);
        await client.query('COMMIT');
        return { success: false, reason: 'Le délai de confirmation de 48h est dépassé.' };
      }

      const memberRes = await client.query(`
        SELECT m.*, f.quotient_familial
        FROM members m
        LEFT JOIN families f ON m.family_id = f.id
        WHERE m.id = $1
      `, [entry.member_id]);

      const activityRes = await client.query(
        'SELECT * FROM activities WHERE id = $1',
        [entry.activity_id]
      );

      const member = memberRes.rows[0];
      const activity = activityRes.rows[0];

      const siblingsRes = await client.query(
        "SELECT COUNT(*) FROM registrations r JOIN members m ON r.member_id = m.id WHERE m.family_id = $1 AND r.activity_id = $2 AND r.status = 'confirmed'",
        [member.family_id, entry.activity_id]
      );
      const siblingCount = parseInt(siblingsRes.rows[0].count);

      const finalPrice = PricingService.calculateFinalPrice(
        member,
        { quotient_familial: member.quotient_familial },
        activity,
        siblingCount
      );

      await client.query(`
        INSERT INTO registrations (member_id, activity_id, final_price, status)
        VALUES ($1, $2, $3, 'confirmed')
      `, [entry.member_id, entry.activity_id, finalPrice]);

      await client.query(
        "UPDATE waiting_list SET status = 'converted' WHERE id = $1",
        [waitingListId]
      );

      await client.query('COMMIT');
      return { success: true, finalPrice };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getWaitingListForActivity(activityId) {
    const query = `
      SELECT wl.*, m.firstname, m.lastname, m.is_resident
      FROM waiting_list wl
      JOIN members m ON wl.member_id = m.id
      WHERE wl.activity_id = $1 AND wl.status IN ('waiting', 'promoted_pending')
      ORDER BY wl.score DESC, wl.created_at ASC;
    `;
    const { rows } = await pool.query(query, [activityId]);
    return rows;
  }
}