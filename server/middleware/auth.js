// Session based role authentication middleware
const userModel = require('../models/userModel');

const STAFF_ROLES = ['admin', 'vendor']; // vendors are canteen sellers

// Refresh the session copy of the user from the database so role changes and
// restrictions made by the administrator take effect immediately.
function freshUser(req) {
  if (!(req.session && req.session.user)) return null;
  const row = userModel.findById(req.session.user.id);
  if (!row) return null; // account was deleted while signed in
  req.session.user = userModel.toPublic(row);
  return req.session.user;
}

function requireAuth(req, res, next) {
  const user = freshUser(req);
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
  if (user.status === 'restricted') {
    return res.status(403).json({ message: 'Your account has been restricted by the administrator.' });
  }
  next();
}

// Vendor or admin access (canteen side)
function requireAdmin(req, res, next) {
  const user = freshUser(req);
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
  if (user.status === 'restricted') {
    return res.status(403).json({ message: 'Your account has been restricted by the administrator.' });
  }
  if (STAFF_ROLES.includes(user.role)) return next();
  res.status(403).json({ message: 'Vendor access required.' });
}

// Administrator only (user management, cross-vendor oversight)
function requireSuperAdmin(req, res, next) {
  const user = freshUser(req);
  if (!user) return res.status(401).json({ message: 'Please sign in to continue.' });
  if (user.status === 'restricted') {
    return res.status(403).json({ message: 'Your account has been restricted by the administrator.' });
  }
  if (user.role === 'admin') return next();
  res.status(403).json({ message: 'Administrator access required.' });
}

// Attaches req.user when a session exists, never blocks the request.
function optionalAuth(req, res, next) {
  req.user = (req.session && req.session.user) || null;
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, optionalAuth, STAFF_ROLES };
