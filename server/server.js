const path = require('path');
const express = require('express');
const session = require('express-session');
require('dotenv').config();

const { ensureSchema } = require('./config/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Create tables on first run (no manual schema import required)
ensureSchema();

app.use(express.json({ limit: '1mb' }));
app.use(
  session({
    name: 'smartcanteen.sid',
    secret: process.env.SESSION_SECRET || 'smart-canteen-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 12 } // 12 hours
  })
);

// Static frontend
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/food', require('./routes/food'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/users', require('./routes/users'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Unknown API route -> JSON 404
app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));

// HTML pages
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/menu', (req, res) => res.sendFile(path.join(publicDir, 'menu.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(publicDir, 'checkout.html')));
app.get('/orders', (req, res) => res.sendFile(path.join(publicDir, 'orders.html')));
app.get('/tracking', (req, res) => res.sendFile(path.join(publicDir, 'tracking.html')));
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(publicDir, 'profile.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin', 'dashboard.html')));
app.get('/admin/:page', (req, res) => {
  const allowed = ['dashboard', 'orders', 'menu', 'inventory', 'sales', 'analytics', 'users'];
  const page = allowed.includes(req.params.page) ? req.params.page : 'dashboard';
  res.sendFile(path.join(publicDir, 'admin', `${page}.html`));
});

// Error handler -> JSON for API, plain for the rest
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on the server.' : err.message;
  if (req.path.startsWith('/api')) return res.status(status).json({ message });
  res.status(status).send(message);
});

app.listen(PORT, () => {
  console.log(`\n  Smart Canteen running at http://localhost:${PORT}\n`);
});
