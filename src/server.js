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

router.get('/api/activities/:id/waiting-list', async (req, res) => {
  try {
    const list = await WaitingListService.getWaitingListForActivity(req.params.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la récupération de la file d\'attente' }));
  }
});

router.post('/api/waiting-list/:id/confirm', async (req, res) => {
  try {
    const result = await WaitingListService.confirmPromotion(req.params.id);
    if (!result.success) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: result.reason }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'CONFIRMED', finalPrice: result.finalPrice }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors de la confirmation', details: error.message }));
  }
});

router.post('/api/waiting-list/expire', async (req, res) => {
  try {
    const results = await WaitingListService.expireOverduePromotions();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ processed: results.length, details: results }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erreur lors du traitement des expirations', details: error.message }));
  }
});

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