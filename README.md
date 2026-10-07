# 🍽️ Smart Canteen Management System

A complete, responsive web application for a college campus canteen. Students browse the live menu, order and pay online, receive a token number and track their order in real time. **Multiple vendors** (canteen sellers) each run their own shop from a shared dashboard: they receive orders, manage their own menu, stock and sales, while the admin sees the whole canteen.

**It solves four real problems:** long queues, manual cash handling, no digital sales records, and stock running out without warning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Bootstrap Icons, Chart.js, Google Fonts (Inter + Poppins) |
| Backend | Node.js, Express.js, express-session, bcryptjs |
| Database | SQLite (`better-sqlite3`) — file-based, zero setup |

> Note: this prototype uses SQLite instead of MySQL so it runs with **no database server installation**. The schema in `database/schema.sql` mirrors the planned MySQL structure (users, food_items, orders, order_items, inventory_logs) and can be ported to MySQL with minor type changes.

---

## Quick Start

### Windows (one click)

Double-click **`start.bat`** — it installs dependencies, creates the database if missing and starts the server.

### Manual

```bash
npm install
npm run db:init     # create + seed the database (optional — see note below)
npm start
```

Then open **http://localhost:3000**

> `npm run db:init` re-creates `data/smartcanteen.db` with demo data. It is optional: if the file is missing, the server auto-creates and seeds it on first start. Re-running `db:init` **resets all data** to the demo state.

Optional configuration: copy `.env.example` to `.env` and adjust `PORT` / `SESSION_SECRET`.

### Tests

```bash
npm test          # 93 end-to-end checks (server must be running)
```

Covers pages, role portals, multi-vendor scoping, order flow (GST, stock deduction, cancel restock), COD payment lifecycle, sales reports, profile/credentials management and the full admin user-management module (create / edit / restrict / restore / delete, safety rules, blocked logins).

---

## 🔑 Accounts

The database ships with a **single administrator account** — all other users are created through the app itself:

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@smartcanteen.com` | `admin123` |

- **Students** and **vendors** register themselves via the **role portals on `/login`**: a *Student portal* (for ordering) and a *Vendor portal* (for selling), each with Sign In / Sign Up tabs.
- The administrator can also create accounts from **User Management** (`/admin/users`).
- Credentials are deliberately not shown in the UI.

---

## Features

### Student
- **Landing page** — hero, benefits, popular items, how-it-works, about
- **Menu** — live availability, stock indicators, search, category filter, price/popularity sorting, popular items section
- **Cart** — slide-out offcanvas, quantity controls, GST calculation, persisted in `localStorage`
- **Checkout** — customer info, pickup time slots, payment via UPI / Wallet / **Cash on Delivery** (settled at the counter)
- **Order confirmation** — token number (e.g. `A-104`), estimated pickup, status
- **Live tracking** — visual status timeline that auto-refreshes every 4 seconds (admin changes appear instantly)
- **My Orders** — full order history with status badges
- **Auth** — separate Student / Vendor portals with register + login (bcrypt-hashed passwords, session cookies)
- **Profile** — `/profile`: edit name, email, student ID / shop name and change your password (current password required)
- **Responsive** — bottom navigation on mobile, 1–2–4 column grids, works from 320px up

### Vendor (role-protected, multiple vendors supported)
- **Multi-vendor ownership** — every food item has an owning vendor (`vendor_id`); vendors register themselves through the Vendor portal and manage their own shop, while unclaimed items belong to the canteen ("house")
- **Scoped management** — a vendor only sees/edits *their* menu items, stock and orders; admins see everything
- **Dashboard** — today's orders, revenue, pending orders, low stock cards + recent orders + low-stock alerts (scoped to the signed-in vendor)
- **Order management** — filter by status/date/search, change status via dropdown (AJAX). Cancelling an order automatically restocks inventory
- **Menu management** — add / edit / delete items (Bootstrap modal), image upload (stored inline) or preset images, availability toggle
- **Inventory** — stock levels, minimum stock, status highlighting (In Stock / Low / Out), manual stock updates with reasons, movement log
- **Sales Management** (`/admin/sales`) — date-range report: gross sales, GST (5%), paid orders, avg order value, refunds and unpaid/COD-pending totals; payment-method and collection-status breakdowns, per-vendor sales table (admin), transactions table with search, CSV export, daily revenue trend chart
- **Reports & analytics** — Chart.js: daily sales, orders per day, popular items, revenue by category; date-range filtering; KPI cards

### Administrator (everything above, plus)
- **User Management** (`/admin/users`) — list every account with search + role/status filters and KPI cards; create students, vendors and admins; edit name, email, student ID / shop name, role and status; reset a password; **restrict** an account (blocked from signing in, live sessions cut off immediately) or restore it; delete accounts — all with confirmation modals
- **Safety rules** — an admin cannot delete, restrict or demote their own account, and the last active administrator can never be demoted or restricted
- **Live enforcement** — every protected request re-reads the account from the database, so a restriction, deletion or role change applies mid-session instantly (restricted/deleted users are signed out on their next request)
- **Full oversight** — vendors are scoped to their own shop; the admin sees all menu items, all orders, all sales, per-vendor breakdowns and every user

### Backend guarantees
- Order placement runs in a **single transaction**: stock is validated, order + items created, inventory deducted, stock log written, unique token generated
- Server-side price calculation (client cannot tamper with prices)
- Role-based authorization: students cannot reach any admin API; user management is administrator-only
- Stock-out and invalid input errors are returned with clear messages
- Passwords hashed with bcrypt; sessions re-validated against the database on every protected request

---

## Project Structure

```
smart-canteen/
├── server/
│   ├── server.js              # Express app, static files, page routes, error handling
│   ├── config/db.js           # SQLite connection, query helpers, transactions, auto-schema
│   ├── middleware/auth.js     # requireAuth / requireAdmin / requireSuperAdmin / optionalAuth
│   ├── routes/                # auth, food, orders, inventory, analytics, users
│   ├── controllers/           # request validation + response handling
│   └── models/                # all SQL lives here
├── public/
│   ├── index.html             # landing page
│   ├── menu.html  checkout.html  orders.html  tracking.html  login.html  profile.html
│   ├── admin/                 # dashboard, orders, menu, inventory, sales, analytics, users
│   ├── css/style.css          # design system + student pages
│   ├── css/admin.css          # admin layout
│   ├── js/                    # app.js, cart.js, menu.js, checkout.js, orders.js,
│   │                          # tracking.js, login.js, profile.js, home.js, admin.js, admin/*
│   └── assets/food/           # 19 generated food images (SVG)
├── database/
│   ├── schema.sql             # tables + demo seed data
│   └── init.js                # npm run db:init
├── scripts/gen-food-assets.js # regenerates food images
├── e2e.test.js                # npm test — 93 end-to-end checks
├── start.bat                  # Windows one-click start
├── data/smartcanteen.db       # created automatically (gitignore-able)
└── package.json
```

---

## API Reference

### Auth
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | logged in |
| GET | `/api/auth/me` | public |
| PUT | `/api/auth/profile` | logged in |

### Food
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/food` (`?category= &search= &sort= &available= &mine=1`) | public (`mine=1` → vendor's own items) |
| GET | `/api/food/:id` | public |
| POST | `/api/food` | staff (vendor items are auto-owned by the vendor) |
| PUT | `/api/food/:id` | owner vendor / admin |
| DELETE | `/api/food/:id` | owner vendor / admin |

### Orders
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/orders` | logged in (student) |
| GET | `/api/orders` (`?scope=all&status=&date=&search=`) | owner / admin (vendors see orders containing their items) |
| GET | `/api/orders/:id` | owner / admin / owning vendor |
| PUT | `/api/orders/:id/status` | admin / owning vendor |

### User Management (administrator only)
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/users` (`?role= &status= &search=`) | admin — list accounts + stats (no password hashes) |
| POST | `/api/users` | admin — create a student / vendor / admin account |
| PUT | `/api/users/:id` | admin — edit details, role, status (restrict/restore) or reset password |
| DELETE | `/api/users/:id` | admin — delete an account (past orders stay in sales history) |

Safety rules enforced server-side: an admin cannot change their own role, restrict or delete their own account, and the last active administrator cannot be demoted or restricted.

### Inventory & Analytics
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/inventory` | staff (vendors see their own items) |
| PUT | `/api/inventory/:id` | owner vendor / admin |
| GET | `/api/analytics/summary` | staff (scoped per vendor) |
| GET | `/api/analytics/daily` (`?from= &to=`) | staff |
| GET | `/api/analytics/weekly` · `/monthly` | staff |
| GET | `/api/analytics/popular` · `/category` | staff |
| GET | `/api/analytics/sales` (`?from= &to=`) | staff (vendors get their own sales; admin also gets a per-vendor breakdown) |

**Order statuses:** `pending → confirmed → preparing → ready → completed` (or `cancelled`, which restocks inventory).
**Payment:** `upi`, `wallet`, `cod`. COD orders stay `payment_status = pending` until the order is completed, then flip to `paid`.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `EADDRINUSE` on port 3000 | Change `PORT` in `.env` or stop the other process |
| Blank/stale demo data | `npm run db:init` (resets everything to the seeded state) |
| Charts not loading | Chart.js loads from a CDN — check your internet connection |
| Login fails | Check you're using the right portal (Student vs Vendor) and the account isn't restricted by the administrator |
