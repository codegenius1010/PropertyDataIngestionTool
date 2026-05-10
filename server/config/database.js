const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('[DB Config] Loading database configuration...');
console.log('[DB Config] Host:', process.env.DB_HOST);
console.log('[DB Config] User:', process.env.DB_USER);
console.log('[DB Config] Database:', process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message);
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] ✓ Database connection successful');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] ✗ Initial connection failed:', err.message);
  });

module.exports = pool;
