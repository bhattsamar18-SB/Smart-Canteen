const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');

// Students register to order; vendors register to sell.
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, student_id, shop_name, role } = req.body;
    const userRole = role === 'vendor' ? 'vendor' : 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (userRole === 'vendor' && !String(shop_name || '').trim()) {
      return res.status(400).json({ message: 'Shop / canteen name is required for a vendor account.' });
    }
    if (await userModel.findByEmail(email)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await userModel.create({
      name,
      email,
      passwordHash,
      studentId: userRole === 'student' ? student_id : null,
      shopName: userRole === 'vendor' ? String(shop_name).trim() : null,
      role: userRole
    });
    req.session.user = userModel.toPublic(user);
    res.status(201).json({ user: req.session.user });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findByEmail(email);
    if (!user || !(await bcrypt.compare(String(password || ''), user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.status === 'restricted') {
      return res.status(403).json({ message: 'Your account has been restricted by the administrator.' });
    }
    req.session.user = userModel.toPublic(user);
    res.json({ user: req.session.user });
  } catch (err) { next(err); }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.json({ message: 'Signed out.' }));
};

exports.me = (req, res) => {
  if (!(req.session && req.session.user)) return res.json({ user: null });
  // Re-check against the database: a deleted or restricted account is signed out now.
  const row = userModel.findById(req.session.user.id);
  if (!row || row.status === 'restricted') {
    return req.session.destroy(() => res.json({ user: null }));
  }
  const user = userModel.toPublic(row);
  req.session.user = user;
  res.json({ user });
};

// Profile & credentials management: name, email, IDs, password change
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, email, student_id, shop_name, password, current_password } = req.body;
    const user = userModel.findById(req.session.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Name cannot be empty.' });
    }
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ message: 'Please enter a valid email.' });
    }
    if (email !== undefined) {
      const existing = userModel.findByEmail(String(email).trim());
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ message: 'That email is already in use.' });
      }
    }

    // Password change requires the current password
    let passwordHash = null;
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      }
      const ok = await bcrypt.compare(String(current_password || ''), user.password);
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect.' });
      passwordHash = await bcrypt.hash(String(password), 10);
    }

    const updated = userModel.updateProfile(user.id, {
      name: name !== undefined ? String(name).trim() : null,
      email: email !== undefined ? String(email).trim() : null,
      studentId: user.role === 'student' && student_id !== undefined ? String(student_id).trim() : undefined,
      shopName: user.role !== 'student' && shop_name !== undefined ? String(shop_name).trim() : undefined,
      passwordHash
    });

    req.session.user = userModel.toPublic(updated);
    res.json({ user: req.session.user });
  } catch (err) { next(err); }
};
