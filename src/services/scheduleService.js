import { pool } from '../config/db.js';

export class ScheduleService {
  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.toString().split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }

  static hasTimeOverlap(startA, endA, startB, endB) {
    const sA = this.timeToMinutes(startA);
    const eA = this.timeToMinutes(endA);
    const sB = this.timeToMinutes(startB);
    const eB = this.timeToMinutes(endB);
    return sA < eB && sB < eA;
  }

  static async checkErpCapacity(facilityId, activityCapacity) {
    const result = await pool.query(
      'SELECT id, name, capacity FROM facilities WHERE id = $1',
      [facilityId]
    );

    if (result.rows.length === 0) {
      return { valid: false, reason: 'Infrastructure introuvable' };
    }

    const facility = result.rows[0];
    const maxAllowed = parseInt(facility.capacity, 10);
    const requested = parseInt(activityCapacity, 10);

    if (requested > maxAllowed) {
      return {
        valid: false,
        facilityCapacity: maxAllowed,
        requestedCapacity: requested,
        reason: `La capacité demandée (${requested}) dépasse la jauge de sécurité ERP de la salle (${maxAllowed})`
      };
    }

    return { valid: true, facility };
  }

  static async checkFacilityCollision(facilityId, dayOfWeek, startTime, endTime, excludeActivityId = null) {
    const targetFacilityRes = await pool.query(
      'SELECT id, name, sub_zone FROM facilities WHERE id = $1',
      [facilityId]
    );

    if (targetFacilityRes.rows.length === 0) {
      return { hasCollision: false };
    }

    const targetFacility = targetFacilityRes.rows[0];

    const activitiesRes = await pool.query(
      `SELECT a.id, a.title, a.start_time, a.end_time, a.day_of_week, a.facility_id,
              f.name AS facility_name, f.sub_zone
       FROM activities a
       JOIN facilities f ON a.facility_id = f.id
       WHERE a.day_of_week = $1`,
      [dayOfWeek]
    );

    for (const act of activitiesRes.rows) {
      if (excludeActivityId && act.id === parseInt(excludeActivityId, 10)) {
        continue;
      }

      const isSameFacility = act.facility_id === targetFacility.id;
      const isSameBuilding = act.facility_name === targetFacility.name;
      const hasZoneConflict = !act.sub_zone || !targetFacility.sub_zone || act.sub_zone === targetFacility.sub_zone;

      if (isSameFacility || (isSameBuilding && hasZoneConflict)) {
        if (this.hasTimeOverlap(startTime, endTime, act.start_time, act.end_time)) {
          return {
            hasCollision: true,
            conflictingActivity: act.title,
            startTime: act.start_time,
            endTime: act.end_time,
            facilityName: act.facility_name,
            subZone: act.sub_zone
          };
        }
      }
    }

    return { hasCollision: false };
  }

  static async checkMemberScheduleConflict(memberId, dayOfWeek, startTime, endTime) {
    const query = `
      SELECT a.id, a.title, a.day_of_week, a.start_time, a.end_time 
      FROM registrations r
      JOIN activities a ON r.activity_id = a.id
      WHERE r.member_id = $1 AND r.status = 'confirmed' AND a.day_of_week = $2
    `;

    const { rows: existingActivities } = await pool.query(query, [memberId, dayOfWeek]);

    for (const current of existingActivities) {
      if (this.hasTimeOverlap(current.start_time, current.end_time, startTime, endTime)) {
        return {
          hasConflict: true,
          conflictingActivity: current.title,
          startTime: current.start_time,
          endTime: current.end_time
        };
      }
    }

    return { hasConflict: false };
  }
}