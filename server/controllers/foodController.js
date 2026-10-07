const foodModel = require('../models/foodModel');

// Helper: if a signed-in vendor asks for their own items only (`?mine=1`),
// restrict the listing. Admins and the public menu always see everything.
function vendorScope(req) {
  const user = req.session && req.session.user;
  if (req.query.mine === '1' && user && user.role === 'vendor') return user.id;
  return undefined;
}

exports.list = async (req, res, next) => {
  try {
    const items = await foodModel.findAll({
      category: req.query.category,
      search: req.query.search,
      sort: req.query.sort,
      available: req.query.available,
      vendorId: vendorScope(req)
    });
    res.json({ items });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const item = await foodModel.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    res.json({ item });
  } catch (err) { next(err); }
};

function validateBody(body) {
  if (!body.name || !body.name.trim()) return 'Food name is required.';
  if (body.price === undefined || body.price === '' || Number(body.price) < 0) return 'A valid price is required.';
  if (!body.category) return 'Category is required.';
  return null;
}

// Vendors may only modify their own items; admins may modify any item.
function assertCanModify(req, existing) {
  const user = req.session.user;
  if (user.role === 'vendor' && existing.vendor_id !== user.id) {
    return 'You can only manage your own food items.';
  }
  return null;
}

exports.create = async (req, res, next) => {
  try {
    const error = validateBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const user = req.session.user;
    const item = await foodModel.create({
      name: req.body.name.trim(),
      description: req.body.description || '',
      price: Number(req.body.price),
      category: req.body.category,
      image: req.body.image || '',
      stock: Number(req.body.stock) || 0,
      minimum_stock: Number(req.body.minimum_stock) || 5,
      available: !!req.body.available,
      // A vendor's new items belong to them; admins can assign or leave house-owned.
      vendorId: user.role === 'vendor' ? user.id : (req.body.vendor_id ?? null)
    });
    res.status(201).json({ item });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await foodModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Item not found.' });
    const denied = assertCanModify(req, existing);
    if (denied) return res.status(403).json({ message: denied });
    const error = validateBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const item = await foodModel.update(req.params.id, {
      name: req.body.name.trim(),
      description: req.body.description || '',
      price: Number(req.body.price),
      category: req.body.category,
      image: req.body.image || '',
      stock: Number(req.body.stock),
      minimum_stock: Number(req.body.minimum_stock),
      available: !!req.body.available
    });
    res.json({ item });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const existing = await foodModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Item not found.' });
    const denied = assertCanModify(req, existing);
    if (denied) return res.status(403).json({ message: denied });
    const ok = await foodModel.remove(req.params.id);
    if (!ok) return res.status(404).json({ message: 'Item not found.' });
    res.json({ message: 'Item deleted.' });
  } catch (err) {
    if (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ message: 'This item appears in past orders and cannot be deleted. Mark it unavailable instead.' });
    }
    next(err);
  }
};
