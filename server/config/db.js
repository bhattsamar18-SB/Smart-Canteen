// SQLite connection (better-sqlite3, synchronous API)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'smartcanteen.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run a statement -> { insertId, changes }
function run(sql, params = []) {
  const info = db.prepare(sql).run(...params);
  return { insertId: Number(info.lastInsertRowid), changes: info.changes, affectedRows: info.changes };
}

// All rows -> array
function query(sql, params = []) {
  return db.prepare(sql).all(...params);
}

// First row -> object | undefined
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

// fn receives { run, query, get } and executes inside BEGIN/COMMIT/ROLLBACK.
// fn must be synchronous (SQLite is a synchronous driver).
function withTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn({ run, query, get });
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Auto-create schema on first run so the app boots immediately.
function ensureSchema() {
  const row = get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (row) return;
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  console.log('Schema initialised: database/schema.sql imported into data/smartcanteen.db');
}

module.exports = { db, run, query, get, withTransaction, ensureSchema };
