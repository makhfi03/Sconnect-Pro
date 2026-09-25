import { pool } from '../config/db.js';

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
      ORDER BY priority_score DESC, created_at ASC
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
}