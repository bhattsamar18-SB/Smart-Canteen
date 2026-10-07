const { run, query, get } = require('../config/db');

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    student_id: row.student_id,
    shop_name: row.shop_name,
    role: row.role,
    status: row.status || 'active',
    created_at: row.created_at || null
  };
}

function findByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? LIMIT 1', [email]) || null;
}

function findById(id) {
  return get('SELECT * FROM users WHERE id = ? LIMIT 1', [id]) || null;
}

function create({ name, email, passwordHash, studentId, shopName, role, status }) {
  const result = run(
    `INSERT INTO users (name, email, password, student_id, shop_name, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, studentId || null, shopName || null, role || 'student', status || 'active']
  );
  return findById(result.insertId);
}

// Partial update - only provided fields are written.
function updateProfile(id, { name, email, studentId, shopName, passwordHash }) {
  if (name !== null && name !== undefined) run('UPDATE users SET name = ? WHERE id = ?', [name, id]);
  if (email !== null && email !== undefined) run('UPDATE users SET email = ? WHERE id = ?', [email, id]);
  if (studentId !== undefined) run('UPDATE users SET student_id = ? WHERE id = ?', [studentId || null, id]);
  if (shopName !== undefined) run('UPDATE users SET shop_name = ? WHERE id = ?', [shopName || null, id]);
  if (passwordHash) run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id]);
  return findById(id);
}

// ---------- User management (administrator) ----------

// All accounts (never includes password hashes).
function list({ search, role, status } = {}) {
  const where = [];
  const params = [];
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (status) { where.push('u.status = ?'); params.push(status); }
  if (search) {
    where.push(`(u.name LIKE ? OR u.email LIKE ?
                 OR COALESCE(u.student_id, '') LIKE ? OR COALESCE(u.shop_name, '') LIKE ?)`);
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  return query(
    `SELECT u.id, u.name, u.email, u.student_id, u.shop_name, u.role, u.status, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
       FROM users u
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.created_at DESC, u.id DESC`,
    params
  );
}

// Counts per role/status for the management dashboard.
function stats() {
  const rows = query('SELECT role, status, COUNT(*) AS count FROM users GROUP BY role, status');
  const out = { total: 0, students: 0, vendors: 0, admins: 0, active: 0, restricted: 0 };
  for (const r of rows) {
    out.total += r.count;
    if (r.role === 'student') out.students += r.count;
    if (r.role === 'vendor') out.vendors += r.count;
    if (r.role === 'admin') out.admins += r.count;
    if (r.status === 'restricted') out.restricted += r.count;
    else out.active += r.count;
  }
  return out;
}

// Admin edit: role, status, details and optional password reset.
function updateById(id, { name, email, studentId, shopName, role, status, passwordHash }) {
  if (name !== undefined && name !== null) run('UPDATE users SET name = ? WHERE id = ?', [name, id]);
  if (email !== undefined && email !== null) run('UPDATE users SET email = ? WHERE id = ?', [email, id]);
  if (studentId !== undefined) run('UPDATE users SET student_id = ? WHERE id = ?', [studentId || null, id]);
  if (shopName !== undefined) run('UPDATE users SET shop_name = ? WHERE id = ?', [shopName || null, id]);
  if (role) run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  if (status) run('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  if (passwordHash) run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id]);
  return findById(id);
}

function remove(id) {
  return run('DELETE FROM users WHERE id = ?', [id]).changes > 0;
}

// Active admins other than `exceptId` - used to protect the last administrator.
function activeAdminCount(exceptId) {
  const row = get(
    `SELECT COUNT(*) AS count FROM users
      WHERE role = 'admin' AND status = 'active' AND id <> ?`,
    [exceptId ?? -1]
  );
  return Number(row.count);
}

module.exports = {
  findByEmail, findById, create, updateProfile, toPublic,
  list, stats, updateById, remove, activeAdminCount
};
