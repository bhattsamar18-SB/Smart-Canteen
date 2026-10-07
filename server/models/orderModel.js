const { run, query, get, withTransaction } = require('../config/db');

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

// ---------- Reads ----------
function attachItems(order) {
  if (!order) return null;
  order.items = query(
    'SELECT food_item_id, food_name, quantity, price FROM order_items WHERE order_id = ?',
    [order.id]
  );
  return order;
}

const SELECT_ORDER = `
  SELECT o.*, u.name AS user_name, u.email AS user_email
  FROM orders o LEFT JOIN users u ON u.id = o.user_id`;

function findById(id) {
  return attachItems(get(`${SELECT_ORDER} WHERE o.id = ? LIMIT 1`, [id]));
}

function listAll({ status, date, search, vendorId } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('o.order_status = ?'); params.push(status); }
  if (date) { where.push("date(o.created_at) = ?"); params.push(date); }
  if (search) {
    where.push('(o.token_number LIKE ? OR o.customer_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  // Vendors only see orders that contain at least one of their items.
  if (vendorId !== undefined && vendorId !== null) {
    where.push(`EXISTS (SELECT 1 FROM order_items oi
                         JOIN food_items f ON f.id = oi.food_item_id
                        WHERE oi.order_id = o.id AND f.vendor_id = ?)`);
    params.push(vendorId);
  }
  const rows = query(
    `${SELECT_ORDER} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.created_at DESC LIMIT 200`,
    params
  );
  return rows.map(attachItems);
}

// Does this order include an item owned by this vendor?
function belongsToVendor(orderId, vendorId) {
  const row = get(
    `SELECT 1 AS ok FROM order_items oi
       JOIN food_items f ON f.id = oi.food_item_id
      WHERE oi.order_id = ? AND f.vendor_id = ? LIMIT 1`,
    [orderId, vendorId]
  );
  return !!row;
}

function listForUser(userId) {
  const rows = query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [userId]
  );
  return rows.map(attachItems);
}

// ---------- Order creation (transactional) ----------
// Validates stock, creates order + items, deducts inventory, generates token.
function createOrder({ userId, customerName, customerMobile, items, pickupTime, paymentMethod }) {
  return withTransaction((tx) => {
    const ids = items.map((i) => Number(i.food_item_id));
    const foods = tx.query(
      `SELECT * FROM food_items WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const byId = new Map(foods.map((f) => [f.id, f]));

    let total = 0;
    const lines = [];
    for (const line of items) {
      const food = byId.get(Number(line.food_item_id));
      const qty = Number(line.quantity);
      if (!food) throw Object.assign(new Error('An item in your cart no longer exists.'), { status: 400 });
      if (!food.available) throw Object.assign(new Error(`${food.name} is currently unavailable.`), { status: 400 });
      if (!Number.isInteger(qty) || qty < 1) {
        throw Object.assign(new Error('Invalid quantity in your cart.'), { status: 400 });
      }
      if (food.stock < qty) {
        throw Object.assign(new Error(
          food.stock === 0
            ? `${food.name} is out of stock.`
            : `Only ${food.stock} left of ${food.name}.`
        ), { status: 400 });
      }
      total += food.price * qty;
      lines.push({ food, qty, price: food.price });
    }

    // 5% GST, matching what the checkout shows
    const subtotal = total;
    const gst = Math.round(subtotal * 5) / 100;
    const grandTotal = Math.round((subtotal + gst) * 100) / 100;
    const paymentStatus = paymentMethod === 'cod' ? 'pending' : 'paid';

    // Unique token for today: A-101, A-102, ...
    const cnt = tx.get(
      "SELECT COUNT(*) AS cnt FROM orders WHERE date(created_at) = date('now')"
    ).cnt;
    const token = `A-${100 + Number(cnt) + 1}`;

    const res = tx.run(
      `INSERT INTO orders (user_id, customer_name, customer_mobile, token_number, total_amount,
         payment_method, payment_status, order_status, pickup_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [userId, customerName, customerMobile || null, token, grandTotal, paymentMethod || 'upi', paymentStatus, pickupTime || null]
    );
    const orderId = res.insertId;

    for (const line of lines) {
      tx.run(
        'INSERT INTO order_items (order_id, food_item_id, food_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, line.food.id, line.food.name, line.qty, line.price]
      );
      tx.run(
        "UPDATE food_items SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?",
        [line.qty, line.food.id]
      );
      tx.run(
        'INSERT INTO inventory_logs (food_item_id, quantity_change, reason) VALUES (?, ?, ?)',
        [line.food.id, -line.qty, `Order ${token} placed`]
      );
    }

    return findById(orderId);
  });
}

// ---------- Status updates ----------
function updateStatus(orderId, status) {
  if (!STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid order status.'), { status: 400 });
  }
  return withTransaction((tx) => {
    const current = tx.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!current) throw Object.assign(new Error('Order not found.'), { status: 404 });

    tx.run(
      "UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, orderId]
    );

    // Cash-on-delivery orders are settled when the order is completed
    if (status === 'completed' && current.payment_status === 'pending') {
      tx.run("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [orderId]);
    }

    // Cancelling an order returns its stock to the inventory.
    if (status === 'cancelled' && current.order_status !== 'cancelled') {
      const items = tx.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      for (const it of items) {
        if (!it.food_item_id) continue;
        tx.run(
          "UPDATE food_items SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?",
          [it.quantity, it.food_item_id]
        );
        tx.run(
          'INSERT INTO inventory_logs (food_item_id, quantity_change, reason) VALUES (?, ?, ?)',
          [it.food_item_id, it.quantity, `Order ${current.token_number} cancelled - restocked`]
        );
      }
    }
    return findById(orderId);
  });
}

module.exports = { createOrder, findById, listAll, listForUser, updateStatus, belongsToVendor, STATUSES };
