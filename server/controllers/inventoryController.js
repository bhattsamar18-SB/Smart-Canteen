const inventoryModel = require('../models/inventoryModel');
const foodModel = require('../models/foodModel');

// Vendors only see and manage their own stock.
function vendorIdOf(req) {
  const user = req.session.user;
  return user.role === 'vendor' ? user.id : undefined;
}

exports.list = async (req, res, next) => {
  try {
    const vendorId = vendorIdOf(req);
    const items = await inventoryModel.list(vendorId);
    const logs = await inventoryModel.logs(25, vendorId);
    res.json({ items, logs });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const item = await foodModel.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    const user = req.session.user;
    if (user.role === 'vendor' && item.vendor_id !== user.id) {
      return res.status(403).json({ message: 'You can only manage stock for your own items.' });
    }
    const updated = await inventoryModel.updateStock(
      req.params.id,
      req.body.stock,
      req.body.reason
    );
    res.json({ item: updated });
  } catch (err) { next(err); }
};
