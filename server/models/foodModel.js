const { run, query, get } = require('../config/db');

const SORTS = {
  price_asc: 'f.price ASC',
  price_desc: 'f.price DESC',
  name: 'f.name ASC',
  popular: 'order_count DESC, f.name ASC'
};

// Public listing with search / category filter / sorting.
// vendorId: undefined = everyone's items (public menu / admin),
//           a number = only that vendor's own items.
function findAll({ category, search, sort, available, vendorId } = {}) {
  const where = [];
  const params = [];

  if (category) { where.push('f.category = ?'); params.push(category); }
  if (search) {
    where.push('(f.name LIKE ? OR f.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (available === 'true') where.push('f.available = 1');
  if (vendorId !== undefined && vendorId !== null) {
    where.push('f.vendor_id = ?');
    params.push(vendorId);
  }

  const order = SORTS[sort] || 'f.id ASC';
  const sql = `
    SELECT f.*, u.name AS vendor_name, u.shop_name AS vendor_shop,
           COALESCE(s.order_count, 0) AS order_count
    FROM food_items f
    LEFT JOIN users u ON u.id = f.vendor_id
    LEFT JOIN (
      SELECT oi.food_item_id AS food_item_id, SUM(oi.quantity) AS order_count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_status <> 'cancelled' AND oi.food_item_id IS NOT NULL
      GROUP BY oi.food_item_id
    ) s ON s.food_item_id = f.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${order}`;
  return query(sql, params);
}

function findById(id) {
  return get(
    `SELECT f.*, u.name AS vendor_name, u.shop_name AS vendor_shop
     FROM food_items f LEFT JOIN users u ON u.id = f.vendor_id
     WHERE f.id = ?`,
    [id]
  ) || null;
}

function create(data) {
  const result = run(
    `INSERT INTO food_items (name, description, price, category, image, stock, minimum_stock, available, vendor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.description || '', data.price, data.category,
     data.image || '', data.stock || 0, data.minimum_stock || 5, data.available ? 1 : 0,
     data.vendorId ?? null]
  );
  return findById(result.insertId);
}

function update(id, data) {
  run(
    `UPDATE food_items SET name = ?, description = ?, price = ?, category = ?, image = ?,
       stock = ?, minimum_stock = ?, available = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.name, data.description || '', data.price, data.category,
     data.image || '', data.stock, data.minimum_stock, data.available ? 1 : 0, id]
  );
  return findById(id);
}

function remove(id) {
  const result = run('DELETE FROM food_items WHERE id = ?', [id]);
  return result.changes > 0;
}

module.exports = { findAll, findById, create, update, remove };
