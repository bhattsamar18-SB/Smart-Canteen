const { query, get } = require('../config/db');

// Every function accepts an optional { vendorId } scope.
// vendorId undefined -> whole canteen (admin); a number -> that vendor only.

// A vendor's share of an order = the pre-GST total of their own line items;
// 5% GST is applied on top, matching the order total shown at checkout.
const VENDOR_SHARE = `
  (SELECT COALESCE(SUM(oi.quantity * oi.price), 0)
     FROM order_items oi
     JOIN food_items f ON f.id = oi.food_item_id
    WHERE oi.order_id = o.id AND f.vendor_id = ?)`;

const HAS_VENDOR_ITEM = `
  EXISTS (SELECT 1 FROM order_items oi
            JOIN food_items f ON f.id = oi.food_item_id
           WHERE oi.order_id = o.id AND f.vendor_id = ?)`;

// Dashboard summary cards.
function summary({ vendorId } = {}) {
  const isVendor = vendorId !== undefined && vendorId !== null;

  const today = isVendor
    ? get(
        `SELECT COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS revenue
         FROM orders o
         WHERE date(o.created_at) = date('now') AND o.order_status <> 'cancelled'
           AND ${HAS_VENDOR_ITEM}`,
        [vendorId, vendorId]
      )
    : get(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
         FROM orders WHERE date(created_at) = date('now') AND order_status <> 'cancelled'`
      );

  const pending = isVendor
    ? get(
        `SELECT COUNT(*) AS count FROM orders o
         WHERE o.order_status IN ('pending','confirmed','preparing') AND ${HAS_VENDOR_ITEM}`,
        [vendorId]
      )
    : get(
        `SELECT COUNT(*) AS count FROM orders
         WHERE order_status IN ('pending','confirmed','preparing')`
      );

  const lowStock = isVendor
    ? get('SELECT COUNT(*) AS count FROM food_items WHERE stock <= minimum_stock AND vendor_id = ?', [vendorId])
    : get('SELECT COUNT(*) AS count FROM food_items WHERE stock <= minimum_stock');

  const week = isVendor
    ? get(
        `SELECT COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS revenue,
                COUNT(DISTINCT o.id) AS orders
         FROM orders o
         WHERE o.created_at >= datetime('now','-7 days') AND o.order_status <> 'cancelled'
           AND ${HAS_VENDOR_ITEM}`,
        [vendorId, vendorId]
      )
    : get(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
         FROM orders WHERE created_at >= datetime('now','-7 days') AND order_status <> 'cancelled'`
      );

  const month = isVendor
    ? get(
        `SELECT COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS revenue,
                COUNT(DISTINCT o.id) AS orders
         FROM orders o
         WHERE o.created_at >= datetime('now','-30 days') AND o.order_status <> 'cancelled'
           AND ${HAS_VENDOR_ITEM}`,
        [vendorId, vendorId]
      )
    : get(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS orders
         FROM orders WHERE created_at >= datetime('now','-30 days') AND order_status <> 'cancelled'`
      );

  const total = isVendor
    ? get(
        `SELECT COUNT(DISTINCT o.id) AS orders,
                COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS revenue
         FROM orders o
         WHERE o.order_status <> 'cancelled' AND ${HAS_VENDOR_ITEM}`,
        [vendorId, vendorId]
      )
    : get(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE order_status <> 'cancelled'`
      );

  return {
    todayOrders: Number(today.orders),
    todayRevenue: Number(today.revenue),
    pendingOrders: Number(pending.count),
    lowStockItems: Number(lowStock.count),
    weekRevenue: Number(week.revenue),
    weekOrders: Number(week.orders),
    monthRevenue: Number(month.revenue),
    monthOrders: Number(month.orders),
    totalOrders: Number(total.orders),
    totalRevenue: Number(total.revenue),
    avgOrderValue: total.orders > 0 ? Number(total.revenue) / Number(total.orders) : 0
  };
}

const RANGES = {
  daily: { fmt: '%Y-%m-%d', days: 7 },
  weekly: { fmt: '%Y-W%W', days: 56 },
  monthly: { fmt: '%Y-%m', days: 365 }
};

// Revenue + order counts grouped by day / week / month, with optional from/to filter.
function series(kind, { from, to, vendorId } = {}) {
  const cfg = RANGES[kind] || RANGES.daily;
  const isVendor = vendorId !== undefined && vendorId !== null;
  const where = ["o.order_status <> 'cancelled'"];
  const params = [];
  if (from) { where.push('o.created_at >= ?'); params.push(from); }
  if (to) { where.push("o.created_at <= ? || ' 23:59:59'"); params.push(to); }
  if (!from && !to) {
    where.push("o.created_at >= datetime('now', ?)");
    params.push(`-${cfg.days} days`);
  }

  if (isVendor) {
    const rows = query(
      `SELECT strftime('${cfg.fmt}', o.created_at) AS label,
              COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS revenue
       FROM orders o
       WHERE ${where.join(' AND ')} AND ${HAS_VENDOR_ITEM}
       GROUP BY label ORDER BY label ASC`,
      [vendorId, ...params, vendorId]
    );
    return rows.map((r) => ({ label: r.label, orders: Number(r.orders), revenue: Number(r.revenue) }));
  }

  const rows = query(
    `SELECT strftime('${cfg.fmt}', created_at) AS label,
            COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
     FROM orders
     WHERE ${where.join(' AND ')}
     GROUP BY label ORDER BY label ASC`,
    params
  );
  return rows.map((r) => ({ label: r.label, orders: Number(r.orders), revenue: Number(r.revenue) }));
}

// Top selling items (optionally only one vendor's items).
function popular(limit = 8, { vendorId } = {}) {
  const isVendor = vendorId !== undefined && vendorId !== null;
  const n = Number(limit) || 8;
  return query(
    `SELECT oi.food_name AS name, SUM(oi.quantity) AS quantity,
            SUM(oi.quantity * oi.price) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN food_items f ON f.id = oi.food_item_id
     WHERE o.order_status <> 'cancelled'${isVendor ? ' AND f.vendor_id = ?' : ''}
     GROUP BY oi.food_name
     ORDER BY quantity DESC
     LIMIT ?`,
    isVendor ? [vendorId, n] : [n]
  );
}

// Revenue grouped by food category (optionally one vendor).
function categoryRevenue({ vendorId } = {}) {
  const isVendor = vendorId !== undefined && vendorId !== null;
  return query(
    `SELECT COALESCE(f.category, 'Other') AS category,
            SUM(oi.quantity * oi.price) AS revenue, SUM(oi.quantity) AS quantity
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN food_items f ON f.id = oi.food_item_id
     WHERE o.order_status <> 'cancelled'${isVendor ? ' AND f.vendor_id = ?' : ''}
     GROUP BY COALESCE(f.category, 'Other')
     ORDER BY revenue DESC`,
    isVendor ? [vendorId] : []
  );
}

// Full sales report: aggregates, payment breakdown and transactions for a date range.
// Admin gets whole-canteen figures; vendors get their own items' performance.
function sales({ from, to, vendorId } = {}) {
  const isVendor = vendorId !== undefined && vendorId !== null;
  const range = [];
  const rangeParams = [];
  if (from) { range.push('o.created_at >= ?'); rangeParams.push(from); }
  else { range.push("o.created_at >= date('now','start of month')"); }
  if (to) { range.push("o.created_at <= ? || ' 23:59:59'"); rangeParams.push(to); }
  const rangeSql = range.join(' AND ');

  let summary;
  let byPayment;
  let transactions;
  let byVendor = [];

  if (isVendor) {
    // Placeholder order in each statement:
    // summary -> 3x VENDOR_SHARE, then HAS_VENDOR_ITEM, then range params
    const s = get(
      `SELECT
         COUNT(DISTINCT CASE WHEN o.order_status <> 'cancelled' THEN o.id END) AS orders,
         COALESCE(SUM(CASE WHEN o.order_status <> 'cancelled' THEN ${VENDOR_SHARE} * 1.05 END), 0) AS gross,
         COUNT(DISTINCT CASE WHEN o.order_status = 'cancelled' THEN o.id END) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN o.order_status = 'cancelled' THEN ${VENDOR_SHARE} * 1.05 END), 0) AS refund_amount,
         COUNT(DISTINCT CASE WHEN o.order_status <> 'cancelled' AND o.payment_status <> 'paid' THEN o.id END) AS unpaid_orders,
         COALESCE(SUM(CASE WHEN o.order_status <> 'cancelled' AND o.payment_status <> 'paid' THEN ${VENDOR_SHARE} * 1.05 END), 0) AS unpaid_amount
       FROM orders o
       WHERE ${rangeSql} AND ${HAS_VENDOR_ITEM}`,
      [vendorId, vendorId, vendorId, ...rangeParams, vendorId]
    );

    // byPayment -> VENDOR_SHARE, HAS_VENDOR_ITEM, then range params
    byPayment = query(
      `SELECT o.payment_method, COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(${VENDOR_SHARE} * 1.05), 0) AS amount
       FROM orders o
       WHERE ${rangeSql} AND o.order_status <> 'cancelled' AND ${HAS_VENDOR_ITEM}
       GROUP BY o.payment_method ORDER BY amount DESC`,
      [vendorId, ...rangeParams, vendorId]
    );

    // transactions -> VENDOR_SHARE, item_count subquery, HAS_VENDOR_ITEM, then range params
    transactions = query(
      `SELECT o.id, o.token_number, o.customer_name, o.payment_method, o.payment_status,
              o.order_status, o.total_amount, o.created_at,
              ${VENDOR_SHARE} * 1.05 AS vendor_amount,
              (SELECT COUNT(*) FROM order_items oi
                 JOIN food_items f2 ON f2.id = oi.food_item_id
                WHERE oi.order_id = o.id AND f2.vendor_id = ?) AS item_count
       FROM orders o
       WHERE ${rangeSql} AND ${HAS_VENDOR_ITEM}
       ORDER BY o.created_at DESC LIMIT 500`,
      [vendorId, vendorId, ...rangeParams, vendorId]
    );

    const gross = Number(s.gross);
    summary = {
      gross,
      taxCollected: Math.round((gross - gross / 1.05) * 100) / 100, // includes 5% GST
      orders: Number(s.orders),
      avgOrderValue: s.orders > 0 ? gross / Number(s.orders) : 0,
      cancelledOrders: Number(s.cancelled_orders),
      refundAmount: Number(s.refund_amount),
      unpaidOrders: Number(s.unpaid_orders),
      unpaidAmount: Number(s.unpaid_amount)
    };
  } else {
    const s = get(
      `SELECT
         COUNT(CASE WHEN order_status <> 'cancelled' THEN 1 END) AS orders,
         COALESCE(SUM(CASE WHEN order_status <> 'cancelled' THEN total_amount END), 0) AS gross,
         COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN order_status = 'cancelled' THEN total_amount END), 0) AS refund_amount,
         COUNT(CASE WHEN order_status <> 'cancelled' AND payment_status <> 'paid' THEN 1 END) AS unpaid_orders,
         COALESCE(SUM(CASE WHEN order_status <> 'cancelled' AND payment_status <> 'paid' THEN total_amount END), 0) AS unpaid_amount
       FROM orders o WHERE ${rangeSql}`, rangeParams
    );

    byPayment = query(
      `SELECT payment_method, COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS amount
       FROM orders o WHERE ${rangeSql} AND order_status <> 'cancelled'
       GROUP BY payment_method ORDER BY amount DESC`, rangeParams
    );

    transactions = query(
      `SELECT o.id, o.token_number, o.customer_name, o.payment_method, o.payment_status,
              o.order_status, o.total_amount, o.created_at,
              (SELECT COALESCE(SUM(quantity),0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o WHERE ${rangeSql}
       ORDER BY o.created_at DESC LIMIT 500`, rangeParams
    );

    // Per-vendor breakdown (admin only): how each seller performed in the range.
    byVendor = query(
      `SELECT COALESCE(u.shop_name, u.name, 'Canteen (house)') AS vendor,
              COUNT(DISTINCT o.id) AS orders,
              COALESCE(SUM(oi.quantity * oi.price * 1.05), 0) AS amount
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN food_items f ON f.id = oi.food_item_id
       LEFT JOIN users u ON u.id = f.vendor_id
       WHERE o.order_status <> 'cancelled' AND ${rangeSql}
       GROUP BY f.vendor_id ORDER BY amount DESC`,
      rangeParams
    );

    const gross = Number(s.gross);
    summary = {
      gross,
      taxCollected: Math.round((gross - gross / 1.05) * 100) / 100, // totals include 5% GST
      orders: Number(s.orders),
      avgOrderValue: s.orders > 0 ? gross / Number(s.orders) : 0,
      cancelledOrders: Number(s.cancelled_orders),
      refundAmount: Number(s.refund_amount),
      unpaidOrders: Number(s.unpaid_orders),
      unpaidAmount: Number(s.unpaid_amount)
    };
  }

  return {
    scope: isVendor ? 'vendor' : 'canteen',
    range: { from: from || "date('now','start of month')", to: to || null },
    summary,
    byPayment: byPayment.map((p) => ({
      method: p.payment_method, orders: Number(p.orders), amount: Number(p.amount)
    })),
    byVendor,
    transactions
  };
}

module.exports = { summary, series, popular, categoryRevenue, sales };
