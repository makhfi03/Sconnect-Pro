import http from 'http';
import dotenv from 'dotenv';
import { pool } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/health' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT NOW()');
      res.writeHead(200);
      res.end(JSON.stringify({ 
        status: 'OK', 
        db_time: result.rows[0].now 
      }));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Database connection failed' }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Route non trouvée' }));
  }
});

server.listen(PORT, () => {
  console.log(`Serveur SportConnect Pro démarré sur http://localhost:${PORT}`);
});