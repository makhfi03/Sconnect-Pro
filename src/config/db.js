import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('Erreur de connexion à PostgreSQL :', err.stack);
  }
  console.log('Connecté avec succès à la BDD PostgreSQL (sportconnect_db)');
  release();
});