-- ============================================================
--  Smart Canteen Management System - SQLite Schema + Demo Data
--  Import with:  npm run db:init
--  (The server also auto-imports this file on first start.)
--  NOTE: re-running this script drops and recreates all tables.
-- ============================================================

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS inventory_logs;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS food_items;
DROP TABLE IF EXISTS users;

-- ---------------- users ----------------
-- status: 'active' = normal access,
--         'restricted' = blocked by the administrator (cannot sign in,
--                        existing sessions are rejected immediately).
-- Only one account is seeded (the Administrator). Students and vendors
-- register themselves through the sign-up portals on /login, and the
-- administrator can also create accounts from User Management.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  student_id TEXT,
  shop_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','vendor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','restricted')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------------- food_items ----------------
-- vendor_id = owning vendor (NULL = house / admin-owned item).
-- Multiple vendors each manage their own items, stock and sales.
CREATE TABLE food_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Snacks'
    CHECK (category IN ('Breakfast','Snacks','Meals','Beverages','Desserts')),
  image TEXT DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 5,
  available INTEGER NOT NULL DEFAULT 1,
  vendor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ---------------- orders ----------------
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT,
  token_number TEXT NOT NULL,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'upi',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  order_status TEXT NOT NULL DEFAULT 'pending',
  pickup_time TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ---------------- order_items ----------------
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
  food_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL
);

-- ---------------- inventory_logs ----------------
CREATE TABLE inventory_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
--  DEMO DATA
-- ============================================================

-- The only seeded account (password documented in README only):
-- Administrator: admin@smartcanteen.com / admin123
INSERT INTO users (name, email, password, student_id, shop_name, role, status) VALUES
('Administrator', 'admin@smartcanteen.com', '$2a$10$wkZmiEWThH/DTzK/qXUjsuAXgF7s0fmTaZqr64RqxGcLtf3sWp5/K', NULL, NULL, 'admin', 'active');

-- Food menu (19 items) - all house (admin) owned until a vendor adds their own.
INSERT INTO food_items (name, description, price, category, image, stock, minimum_stock, available, vendor_id) VALUES
('Masala Dosa', 'Crispy rice crepe stuffed with spiced potato, served with sambar and chutney', 50, 'Breakfast', '/assets/food/dosa.svg', 25, 5, 1, NULL),
('Idli Sambar', 'Steamed rice cakes with hot sambar and coconut chutney', 30, 'Breakfast', '/assets/food/idli.svg', 30, 5, 1, NULL),
('Aloo Paratha', 'Stuffed potato paratha with butter, curd and pickle', 40, 'Breakfast', '/assets/food/paratha.svg', 18, 5, 1, NULL),
('Bread Omelette', 'Fluffy masala omelette folded between buttered bread slices', 35, 'Breakfast', '/assets/food/omelette.svg', 15, 5, 1, NULL),
('Samosa', 'Golden fried pastry filled with spiced potatoes and peas', 20, 'Snacks', '/assets/food/samosa.svg', 0, 10, 1, NULL),
('Veg Sandwich', 'Grilled sandwich with fresh vegetables and mint mayo', 40, 'Snacks', '/assets/food/sandwich.svg', 20, 5, 1, NULL),
('Pav Bhaji', 'Buttery mashed vegetable curry served with toasted pav', 60, 'Snacks', '/assets/food/pavbhaji.svg', 18, 5, 1, NULL),
('Burger', 'Crispy veg patty with lettuce, cheese and house sauce', 70, 'Snacks', '/assets/food/burger.svg', 12, 5, 1, NULL),
('French Fries', 'Golden salted fries with ketchup', 50, 'Snacks', '/assets/food/fries.svg', 14, 5, 1, NULL),
('Veg Pizza', 'Wood-fired style pizza topped with vegetables and cheese', 80, 'Snacks', '/assets/food/pizza.svg', 10, 4, 1, NULL),
('Veg Thali', 'Complete meal with 2 rotis, dal, sabzi, rice, salad and pickle', 90, 'Meals', '/assets/food/thali.svg', 12, 4, 1, NULL),
('Fried Rice', 'Wok tossed rice with vegetables and Indo-Chinese sauces', 70, 'Meals', '/assets/food/friedrice.svg', 15, 4, 1, NULL),
('Paneer Roll', 'Spiced paneer wrapped in a soft eggless paratha', 60, 'Meals', '/assets/food/paneerroll.svg', 10, 4, 1, NULL),
('Tea', 'Freshly brewed masala chai with ginger and cardamom', 15, 'Beverages', '/assets/food/tea.svg', 8, 20, 1, NULL),
('Cold Coffee', 'Chilled blended coffee topped with froth', 50, 'Beverages', '/assets/food/coldcoffee.svg', 16, 5, 1, NULL),
('Fresh Juice', 'Seasonal fresh fruit juice, no added sugar', 40, 'Beverages', '/assets/food/juice.svg', 20, 5, 1, NULL),
('Mango Lassi', 'Thick yogurt drink blended with sweet mango pulp', 45, 'Beverages', '/assets/food/lassi.svg', 12, 5, 1, NULL),
('Chocolate Cake', 'Moist chocolate sponge layered with dark chocolate ganache', 50, 'Desserts', '/assets/food/cake.svg', 9, 4, 1, NULL),
('Ice Cream Cup', 'Vanilla ice cream cup with chocolate chips', 30, 'Desserts', '/assets/food/icecream.svg', 20, 5, 1, NULL);

-- Historical walk-in orders (kept so the analytics & sales pages have data).
-- The original accounts were removed, so user_id is NULL while the captured
-- customer details remain - exactly what happens when an account is deleted.
INSERT INTO orders (id, user_id, customer_name, customer_mobile, token_number, total_amount, payment_method, payment_status, order_status, pickup_time, created_at) VALUES
(1,  NULL, 'Rahul Sharma', '9876500001', 'A-101', 100, 'upi',    'paid', 'completed', '12:45:00', datetime('now','-6 days')),
(2,  NULL, 'Priya Patel',  '9876500002', 'A-102',  85, 'wallet', 'paid', 'completed', '10:15:00', datetime('now','-5 days')),
(3,  NULL, 'Amit Verma',   '9876500003', 'A-103', 140, 'upi',    'paid', 'completed', '13:00:00', datetime('now','-4 days')),
(4,  NULL, 'Sneha Iyer',   '9876500004', 'A-104',  85, 'card',   'paid', 'completed', '12:30:00', datetime('now','-3 days')),
(5,  NULL, 'Karan Mehta',  '9876500005', 'A-105', 210, 'upi',    'paid', 'completed', '12:50:00', datetime('now','-2 days')),
(6,  NULL, 'Rahul Sharma', '9876500001', 'A-106',  95, 'wallet', 'paid', 'completed', '10:30:00', datetime('now','-2 days')),
(7,  NULL, 'Priya Patel',  '9876500002', 'A-107', 130, 'upi',    'paid', 'completed', '13:10:00', datetime('now','-1 day')),
(8,  NULL, 'Amit Verma',   '9876500003', 'A-108',  90, 'upi',    'paid', 'cancelled', '12:40:00', datetime('now','-1 day')),
(9,  NULL, 'Sneha Iyer',   '9876500004', 'A-109', 150, 'card',   'paid', 'completed', '12:35:00', datetime('now','-1 day')),
(10, NULL, 'Karan Mehta',  '9876500005', 'A-110', 215, 'upi',    'paid', 'preparing', '13:05:00', datetime('now','-3 hours')),
(11, NULL, 'Rahul Sharma', '9876500001', 'A-111',  90, 'wallet', 'paid', 'ready',     '12:55:00', datetime('now','-2 hours')),
(12, NULL, 'Priya Patel',  '9876500002', 'A-112', 155, 'upi',    'paid', 'pending',   '13:15:00', datetime('now','-20 minutes'));

INSERT INTO order_items (order_id, food_item_id, food_name, quantity, price) VALUES
(1, 1, 'Masala Dosa', 1, 50), (1, 14, 'Tea', 2, 15), (1, 5, 'Samosa', 1, 20),
(2, 3, 'Aloo Paratha', 1, 40), (2, 14, 'Tea', 1, 15), (2, 19, 'Ice Cream Cup', 1, 30),
(3, 11, 'Veg Thali', 1, 90), (3, 15, 'Cold Coffee', 1, 50),
(4, 6, 'Veg Sandwich', 1, 40), (4, 14, 'Tea', 1, 15), (4, 19, 'Ice Cream Cup', 1, 30),
(5, 10, 'Veg Pizza', 2, 80), (5, 15, 'Cold Coffee', 1, 50),
(6, 8, 'Burger', 1, 70), (6, 9, 'French Fries', 1, 25),
(7, 7, 'Pav Bhaji', 1, 60), (7, 12, 'Fried Rice', 1, 70),
(8, 1, 'Masala Dosa', 1, 50), (8, 16, 'Fresh Juice', 1, 40),
(9, 11, 'Veg Thali', 1, 90), (9, 17, 'Mango Lassi', 1, 45), (9, 14, 'Tea', 1, 15),
(10, 8, 'Burger', 1, 70), (10, 10, 'Veg Pizza', 1, 80), (10, 15, 'Cold Coffee', 1, 50), (10, 14, 'Tea', 1, 15),
(11, 11, 'Veg Thali', 1, 90),
(12, 4, 'Bread Omelette', 1, 35), (12, 6, 'Veg Sandwich', 1, 40), (12, 16, 'Fresh Juice', 1, 40), (12, 14, 'Tea', 2, 15), (12, 19, 'Ice Cream Cup', 1, 10);

INSERT INTO inventory_logs (food_item_id, quantity_change, reason) VALUES
(1, -25, 'Initial stock'),
(5, -10, 'Morning restock used'),
(14, -40, 'Initial stock'),
(11, -12, 'Initial stock'),
(18, -5, 'Initial stock');
