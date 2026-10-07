// User management - administrator creates, edits, restricts and deletes accounts.
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');

const ROLES = ['student', 'vendor', 'admin'];
const STATUSES = ['active', 'restricted'];

// ---------- GET /api/users ----------
exports.list = async (req, res, next) => {
  try {
    const users = userModel.list({
      search: req.query.search,
      role: req.query.role,
      status: req.query.status
    });
    res.json({ users, stats: userModel.stats() });
  } catch (err) { next(err); }
};

// ---------- POST /api/users ----------
exports.create = async (req, res, next) => {
  try {
    const { name, email, password, role, student_id, shop_name, status } = req.body;

    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    const userRole = ROLES.includes(role) ? role : 'student';
    if (userRole === 'vendor' && !String(shop_name || '').trim()) {
      return res.status(400).json({ message: 'Shop / canteen name is required for a vendor account.' });
    }
    if (userModel.findByEmail(String(email).trim())) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await userModel.create({
      name: String(name).trim(),
      email: String(email).trim(),
      passwordHash: await bcrypt.hash(String(password), 10),
      studentId: userRole === 'student' ? student_id : null,
      shopName: userRole === 'vendor' ? String(shop_name).trim() : null,
      role: userRole,
      status: STATUSES.includes(status) ? status : 'active'
    });
    res.status(201).json({ user: userModel.toPublic(user) });
  } catch (err) { next(err); }
};

// ---------- PUT /api/users/:id ----------
exports.update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const target = userModel.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    const me = req.session.user;
    const isSelf = me.id === id;
    const { name, email, role, status, student_id, shop_name, password } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Name cannot be empty.' });
    }
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ message: 'Please enter a valid email.' });
    }
    if (email !== undefined) {
      const existing = userModel.findByEmail(String(email).trim());
      if (existing && existing.id !== id) {
        return res.status(409).json({ message: 'That email is already in use.' });
      }
    }
    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    if (isSelf && status === 'restricted') {
      return res.status(400).json({ message: 'You cannot restrict your own account.' });
    }
    if (isSelf && role !== undefined && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }
    if (password !== undefined && password !== null && String(password) &&
        String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    // Never let the last active administrator be demoted or restricted.
    const losingAdmin =
      target.role === 'admin' &&
      ((role !== undefined && role !== 'admin') || status === 'restricted');
    if (losingAdmin && userModel.activeAdminCount(id) === 0) {
      return res.status(400).json({ message: 'At least one active administrator must remain.' });
    }

    // Details are validated/written against the role the account will HAVE
    // after this update (an admin may change role and details in one save).
    const effectiveRole = role !== undefined ? role : target.role;
    const nextStudentId = student_id !== undefined ? String(student_id).trim() : undefined;
    const nextShopName = shop_name !== undefined ? String(shop_name).trim() : undefined;
    if (effectiveRole === 'vendor' && !nextShopName && !target.shop_name) {
      return res.status(400).json({ message: 'Shop / canteen name is required for a vendor account.' });
    }

    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;
    const updated = userModel.updateById(id, {
      name: name !== undefined ? String(name).trim() : undefined,
      email: email !== undefined ? String(email).trim() : undefined,
      studentId: effectiveRole === 'student' ? nextStudentId : null,
      shopName: effectiveRole === 'vendor' ? nextShopName : null,
      role,
      status,
      passwordHash
    });

    // Keep the account's own session in sync when an admin edits it.
    if (req.session.user && req.session.user.id === id) {
      req.session.user = userModel.toPublic(updated);
    }
    res.json({ user: userModel.toPublic(updated) });
  } catch (err) { next(err); }
};

// ---------- DELETE /api/users/:id ----------
exports.remove = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const target = userModel.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    if (req.session.user.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }
    if (target.role === 'admin' && userModel.activeAdminCount(id) === 0) {
      return res.status(400).json({ message: 'At least one active administrator must remain.' });
    }

    userModel.remove(id);
    res.json({ message: `Account for ${target.name} deleted.` });
  } catch (err) { next(err); }
};
