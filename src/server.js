import http from 'http';
import dotenv from 'dotenv';
import { Router } from './core/router.js';
import { pool } from './config/db.js';

import { HomeController } from './controllers/homeController.js';
import { FacilityController } from './controllers/facilityController.js';
import { ActivityController } from './controllers/activityController.js';
import { MemberController } from './controllers/memberController.js';
import { RegistrationController } from './controllers/registrationController.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const router = new Router();

router.get('/api/stats', HomeController.getStats);
router.get('/api/facilities', FacilityController.getAll);
router.get('/api/activities', ActivityController.getAll);
router.get('/api/members', MemberController.getAll);
router.post('/api/registrations', RegistrationController.create);

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/health' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT NOW()');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'OK', db_time: result.rows[0].now }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Database connection failed' }));
    }
  }

  await router.handle(req, res);
});

server.listen(PORT, () => {
  console.log(`Serveur SportConnect Pro démarré sur http://localhost:${PORT}`);
});