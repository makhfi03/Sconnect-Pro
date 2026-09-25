import { pool } from '../config/db.js';

export class ScheduleService {
  static hasTimeOverlap(start1, end1, start2, end2) {
    return (start1 < end2) && (end1 > start2);
  }

  static async checkScheduleConflict(memberId, newActivity) {
    const query = `
      SELECT a.id, a.title, a.day_of_week, a.start_time, a.end_time 
      FROM registrations r
      JOIN activities a ON r.activity_id = a.id
      WHERE r.member_id = $1 AND r.status = 'confirmed'
    `;
    
    const { rows: existingActivities } = await pool.query(query, [memberId]);

    for (const current of existingActivities) {
      if (current.day_of_week === newActivity.day_of_week) {
        if (this.hasTimeOverlap(current.start_time, current.end_time, newActivity.start_time, newActivity.end_time)) {
          return {
            hasConflict: true,
            conflictingActivity: current.title
          };
        }
      }
    }

    return { hasConflict: false };
  }
}