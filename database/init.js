/**
 * Imports database/schema.sql into the SQLite database (data/smartcanteen.db).
 * Usage:  npm run db:init
 *
 * WARNING: drops and recreates all tables (demo data is restored).
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'smartcanteen.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

try {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  console.log('Database initialised:', dbPath);
  console.log('Administrator: admin@smartcanteen.com / admin123');
  console.log('Note: students and vendors register themselves via /login.');
} catch (err) {
  console.error('Failed to initialise database:', err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
