import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import serveStatic from 'serve-static';
import { Router } from './core/router.js';
import { Renderer } from './core/renderer.js';
import { parseBody } from './core/bodyParser.js';
import { pool } from './config/db.js';

import { HomeController } from './controllers/homeController.js';
import { FacilityController } from './controllers/facilityController.js';
import { ActivityController } from './controllers/activityController.js';
import { MemberController } from './controllers/memberController.js';
import { RegistrationController } from './controllers/registrationController.js';
import { WaitingListService } from './services/waitingListService.js';
import { ScheduleService } from './services/scheduleService.js';
import { EligibilityService } from './services/eligibilityService.js';
import { PricingService } from './services/pricingService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

const PORT = process.env.PORT || 3000;

const serve = serveStatic(PUBLIC_DIR, { index: false });

const router = new Router({
  defaultRoute: (req, res) => {
    Renderer.render(res, 'error', {
      statusCode: 404,
      title: 'Page non trouvée',
      message: 'La page ou ressource demandée n\'existe pas.'
    }, 404);
  }
});

router.get('/', async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM members) AS total_members,
        (SELECT COUNT(*) FROM activities) AS total_activities,
        (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed') AS total_registrations,
        (SELECT COUNT(*) FROM waiting_list WHERE status = 'waiting') AS total_waiting,
        (SELECT COALESCE(SUM(final_price), 0) FROM registrations WHERE status = 'confirmed') AS total_revenue
    `);

    const topActivitiesRes = await pool.query(`
      SELECT 
        a.id, a.title, a.max_capacity,
        COUNT(r.id) FILTER (WHERE r.status = 'confirmed') AS confirmed_count,
        CASE WHEN a.max_capacity > 0
          THEN ROUND((COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::numeric / a.max_capacity) * 100, 1)
          ELSE 0
        END AS fill_rate_percent
      FROM activities a
      LEFT JOIN registrations r ON a.id = r.activity_id
      GROUP BY a.id, a.title, a.max_capacity
      ORDER BY fill_rate_percent DESC
      LIMIT 5
    `);

    const revenueByActivityRes = await pool.query(`
      SELECT 
        a.title,
        COUNT(r.id) AS registration_count,
        COALESCE(SUM(r.final_price), 0) AS revenue
      FROM activities a
      LEFT JOIN registrations r ON a.id = r.activity_id AND r.status = 'confirmed'
      GROUP BY a.id, a.title
      ORDER BY revenue DESC
      LIMIT 5
    `);

    await Renderer.render(res, 'pages/dashboard', {
      title: 'Tableau de Bord',
      overview: statsRes.rows[0],
      top_activities: topActivitiesRes.rows,
      revenue_by_activity: revenueByActivityRes.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le tableau de bord.'
    }, 500);
  }
});

router.get('/facilities', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
    await Renderer.render(res, 'pages/facilities', {
      title: 'Infrastructures Sportives',
      facilities: result.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger les infrastructures.'
    }, 500);
  }
});

router.get('/activities', async (req, res) => {
  try {
    const query = `
      SELECT a.*, f.name AS facility_name, ass.name AS association_name,
             (a.max_capacity - COUNT(r.id) FILTER (WHERE r.status = 'confirmed')) AS remaining_seats
      FROM activities a
      LEFT JOIN facilities f ON a.facility_id = f.id
      LEFT JOIN associations ass ON a.association_id = ass.id
      LEFT JOIN registrations r ON a.id = r.activity_id
      GROUP BY a.id, f.name, ass.name
      ORDER BY a.day_of_week ASC, a.start_time ASC;
    `;
    const result = await pool.query(query);
    await Renderer.render(res, 'pages/activities', {
      title: 'Catalogue des Activités',
      activities: result.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le catalogue.'
    }, 500);
  }
});

router.get('/activities/new', async (req, res) => {
  try {
    const facilities = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
    await Renderer.render(res, 'pages/activity-form', {
      title: 'Planifier une Activité',
      facilities: facilities.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le formulaire.'
    }, 500);
  }
});

router.post('/activities/new', async (req, res) => {
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

    const erpCheck = await ScheduleService.checkErpCapacity(facility_id, max_capacity);
    if (!erpCheck.valid) {
      const facilities = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
      return await Renderer.render(res, 'pages/activity-form', {
        title: 'Planifier une Activité',
        facilities: facilities.rows,
        error: erpCheck.reason
      }, 400);
    }

    const collisionCheck = await ScheduleService.checkFacilityCollision(
      facility_id,
      parseInt(day_of_week, 10),
      start_time,
      end_time
    );

    if (collisionCheck.hasCollision) {
      const facilities = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
      return await Renderer.render(res, 'pages/activity-form', {
        title: 'Planifier une Activité',
        facilities: facilities.rows,
        error: `Conflit d'occupation : la salle est déjà réservée pour "${collisionCheck.conflictingActivity}" (${collisionCheck.startTime} - ${collisionCheck.endTime})`
      }, 400);
    }

    await pool.query(`
      INSERT INTO activities (
        association_id, facility_id, title, base_price, max_capacity,
        day_of_week, start_time, end_time, min_age, max_age, is_high_risk_sport
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
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
      !!is_high_risk_sport
    ]);

    res.writeHead(302, { Location: '/activities' });
    res.end();
  } catch (error) {
    console.error(error);
    const facilities = await pool.query('SELECT * FROM facilities ORDER BY name ASC');
    await Renderer.render(res, 'pages/activity-form', {
      title: 'Planifier une Activité',
      facilities: facilities.rows,
      error: 'Erreur lors de la création : ' + error.message
    }, 500);
  }
});

router.get('/members', async (req, res) => {
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

    await Renderer.render(res, 'pages/members', {
      title: 'Registre des Adhérents',
      members
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le registre des adhérents.'
    }, 500);
  }
});

router.get('/members/new', async (req, res) => {
  try {
    const families = await pool.query('SELECT * FROM families ORDER BY family_code ASC');
    await Renderer.render(res, 'pages/member-form', {
      title: 'Nouvel Adhérent',
      families: families.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le formulaire adhérent.'
    }, 500);
  }
});

router.post('/members/new', async (req, res) => {
  try {
    const {
      family_id,
      firstname,
      lastname,
      birth_date,
      is_resident = 'true',
      cert_medical_date,
      passport_code = null
    } = req.body;

    await pool.query(`
      INSERT INTO members (family_id, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      family_id ? parseInt(family_id, 10) : null,
      firstname,
      lastname,
      birth_date,
      is_resident === 'true',
      cert_medical_date,
      passport_code || null
    ]);

    res.writeHead(302, { Location: '/members' });
    res.end();
  } catch (error) {
    console.error(error);
    const families = await pool.query('SELECT * FROM families ORDER BY family_code ASC');
    await Renderer.render(res, 'pages/member-form', {
      title: 'Nouvel Adhérent',
      families: families.rows,
      error: 'Erreur lors de la création : ' + error.message
    }, 500);
  }
});

router.get('/checkout', async (req, res) => {
  try {
    const membersRes = await pool.query('SELECT * FROM members ORDER BY lastname ASC, firstname ASC');
    const activitiesRes = await pool.query('SELECT * FROM activities ORDER BY title ASC');

    const selectedMemberId = req.query?.member_id || '';
    const selectedActivityId = req.query?.activity_id || '';

    let quoteData = null;

    if (selectedMemberId && selectedActivityId) {
      const memberRes = await pool.query(`
        SELECT m.*, f.quotient_familial 
        FROM members m 
        LEFT JOIN families f ON m.family_id = f.id 
        WHERE m.id = $1
      `, [selectedMemberId]);

      const activityRes = await pool.query('SELECT * FROM activities WHERE id = $1', [selectedActivityId]);

      if (memberRes.rows.length > 0 && activityRes.rows.length > 0) {
        const member = memberRes.rows[0];
        const activity = activityRes.rows[0];

        const siblingsRes = await pool.query(
          "SELECT COUNT(*) FROM registrations r JOIN members m ON r.member_id = m.id WHERE m.family_id = $1 AND r.activity_id = $2 AND r.status = 'confirmed'",
          [member.family_id, selectedActivityId]
        );
        const siblingCount = parseInt(siblingsRes.rows[0].count);

        const quote = PricingService.generateQuote(
          member,
          { quotient_familial: member.quotient_familial },
          activity,
          siblingCount
        );

        quoteData = { quote };
      }
    }

    await Renderer.render(res, 'pages/checkout', {
      title: 'Tunnel d\'Inscription',
      members: membersRes.rows,
      activities: activitiesRes.rows,
      selectedMemberId,
      selectedActivityId,
      quoteData
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le tunnel d\'inscription.'
    }, 500);
  }
});

router.post('/checkout/preview', async (req, res) => {
  const { member_id, activity_id } = req.body;
  res.writeHead(302, { Location: `/checkout?member_id=${member_id}&activity_id=${activity_id}` });
  res.end();
});

router.post('/checkout/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    const { member_id, activity_id } = req.body;

    const memberRes = await client.query(`
      SELECT m.*, f.quotient_familial 
      FROM members m 
      LEFT JOIN families f ON m.family_id = f.id 
      WHERE m.id = $1
    `, [member_id]);
    const member = memberRes.rows[0];

    const activityRes = await client.query('SELECT * FROM activities WHERE id = $1', [activity_id]);
    const activity = activityRes.rows[0];

    const eligibility = EligibilityService.validateMemberForActivity(member, activity);
    if (!eligibility.eligible) {
      return res.end(JSON.stringify({ error: eligibility.reason }));
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
      res.writeHead(302, { Location: '/registrations' });
      return res.end();
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

    await client.query(`
      INSERT INTO registrations (member_id, activity_id, final_price, status)
      VALUES ($1, $2, $3, 'confirmed')
    `, [member_id, activity_id, finalPrice]);

    await client.query('COMMIT');

    res.writeHead(302, { Location: '/registrations' });
    res.end();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  } finally {
    client.release();
  }
});

router.get('/registrations', async (req, res) => {
  try {
    const regsRes = await pool.query(`
      SELECT r.*, m.firstname, m.lastname, a.title AS activity_title
      FROM registrations r
      JOIN members m ON r.member_id = m.id
      JOIN activities a ON r.activity_id = a.id
      WHERE r.status = 'confirmed'
      ORDER BY r.created_at DESC;
    `);

    const wlRes = await pool.query(`
      SELECT wl.*, m.firstname, m.lastname, a.title AS activity_title
      FROM waiting_list wl
      JOIN members m ON wl.member_id = m.id
      JOIN activities a ON wl.activity_id = a.id
      WHERE wl.status IN ('waiting', 'promoted_pending')
      ORDER BY wl.score DESC, wl.created_at ASC;
    `);

    await Renderer.render(res, 'pages/registrations', {
      title: 'Suivi des Inscriptions',
      registrations: regsRes.rows,
      waitingList: wlRes.rows
    });
  } catch (error) {
    console.error(error);
    await Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Impossible de charger le suivi des inscriptions.'
    }, 500);
  }
});

router.post('/registrations/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = req.params?.id;
    await client.query('BEGIN');

    const regRes = await client.query('SELECT * FROM registrations WHERE id = $1 FOR UPDATE', [id]);
    if (regRes.rows.length > 0) {
      const registration = regRes.rows[0];
      await client.query("UPDATE registrations SET status = 'cancelled' WHERE id = $1", [id]);
      await WaitingListService.promoteNextInLine(registration.activity_id, client);
    }

    await client.query('COMMIT');
    res.writeHead(302, { Location: '/registrations' });
    res.end();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  } finally {
    client.release();
  }
});

router.post('/waiting-list/expire-check', async (req, res) => {
  try {
    await WaitingListService.expireOverduePromotions();
    res.writeHead(302, { Location: '/registrations' });
    res.end();
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

router.post('/waiting-list/:id/confirm-ui', async (req, res) => {
  try {
    await WaitingListService.confirmPromotion(req.params.id);
    res.writeHead(302, { Location: '/registrations' });
    res.end();
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

router.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', db_time: result.rows[0].now }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Database connection failed' }));
  }
});

router.get('/api/stats', HomeController.getStats);
router.get('/api/facilities', FacilityController.getAll);
router.post('/api/facilities', FacilityController.create);
router.get('/api/activities', ActivityController.getAll);
router.get('/api/activities/:id', ActivityController.getById);
router.post('/api/activities', ActivityController.create);
router.get('/api/members', MemberController.getAll);
router.get('/api/members/:id', MemberController.getById);
router.post('/api/members', MemberController.create);
router.put('/api/members/:id', MemberController.update);
router.post('/api/registrations/quote', RegistrationController.quote);
router.post('/api/registrations', RegistrationController.create);
router.post('/api/registrations/:id/cancel', RegistrationController.cancel);

const server = http.createServer(async (req, res) => {
  try {
    await parseBody(req);
    serve(req, res, () => {
      router.lookup(req, res);
    });
  } catch (error) {
    console.error(error);
    Renderer.render(res, 'error', {
      statusCode: 500,
      title: 'Erreur Serveur',
      message: 'Une erreur interne est survenue.'
    }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Serveur SportConnect Pro démarré sur http://localhost:${PORT}`);
});