const { run, query, get, withTransaction } = require('../config/db');

// Inventory overview = food items + stock status + last updated.
// vendorId: undefined = all items (admin), a number = that vendor's items only.
function list(vendorId) {
  const where = [];
  const params = [];
  if (vendorId !== undefined && vendorId !== null) {
    where.push('vendor_id = ?');
    params.push(vendorId);
  }
  return query(
    `SELECT id, name, category, image, stock, minimum_stock, available, updated_at, vendor_id,
       CASE
         WHEN stock = 0 THEN 'out'
         WHEN stock <= minimum_stock THEN 'low'
         ELSE 'ok'
       END AS stock_status
     FROM food_items
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY stock ASC, name ASC`,
    params
  );
}

// Update stock level (manual correction) and log the change.
function updateStock(id, stock, reason) {
  const value = Number(stock);
  if (stock === undefined || stock === null || Number.isNaN(value) || value < 0) {
    throw Object.assign(new Error('Stock must be a number of 0 or more.'), { status: 400 });
  }
  return withTransaction((tx) => {
    const item = tx.get('SELECT * FROM food_items WHERE id = ?', [id]);
    if (!item) throw Object.assign(new Error('Item not found.'), { status: 404 });

    const change = value - item.stock;
    tx.run(
      "UPDATE food_items SET stock = ?, updated_at = datetime('now') WHERE id = ?",
      [value, id]
    );
    if (change !== 0) {
      tx.run(
        'INSERT INTO inventory_logs (food_item_id, quantity_change, reason) VALUES (?, ?, ?)',
        [id, change, reason || 'Manual stock update']
      );
    }
    return tx.get('SELECT * FROM food_items WHERE id = ?', [id]);
  });
}

function logs(limit = 50, vendorId) {
  const where = [];
  const params = [];
  if (vendorId !== undefined && vendorId !== null) {
    where.push('f.vendor_id = ?');
    params.push(vendorId);
  }
  params.push(Number(limit) || 50);
  return query(
    `SELECT l.*, f.name AS food_name
     FROM inventory_logs l LEFT JOIN food_items f ON f.id = l.food_item_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY l.created_at DESC LIMIT ?`,
    params
  );
}

module.exports = { list, updateStock, logs };
