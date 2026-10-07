const orderModel = require('../models/orderModel');

function isStaff(user) { return user.role === 'admin' || user.role === 'vendor'; }

// POST /api/orders - place a new order (student)
exports.create = async (req, res, next) => {
  try {
    const { items, customer, pickup_time, payment_method } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }
    if (!customer || !customer.name || !customer.mobile) {
      return res.status(400).json({ message: 'Name and mobile number are required.' });
    }
    if (!/^\d{10}$/.test(String(customer.mobile))) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit mobile number.' });
    }
    const allowedPayments = ['upi', 'wallet', 'card', 'cod'];
    if (!allowedPayments.includes(payment_method)) {
      return res.status(400).json({ message: 'Please choose a payment method.' });
    }

    const order = await orderModel.createOrder({
      userId: req.session.user.id,
      customerName: customer.name,
      customerMobile: customer.mobile,
      items: items.map((i) => ({
        food_item_id: Number(i.food_item_id),
        quantity: Number(i.quantity)
      })),
      pickupTime: pickup_time || null,
      paymentMethod: payment_method
    });
    res.status(201).json({ order });
  } catch (err) { next(err); }
};

// GET /api/orders - students see their own, vendors see orders with their
// items, admins see everything (scope=all).
exports.list = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (isStaff(user) && req.query.scope === 'all') {
      const orders = await orderModel.listAll({
        status: req.query.status,
        date: req.query.date,
        search: req.query.search,
        vendorId: user.role === 'vendor' ? user.id : undefined
      });
      return res.json({ orders });
    }
    const orders = await orderModel.listForUser(user.id);
    res.json({ orders });
  } catch (err) { next(err); }
};

// GET /api/orders/:id - owner, admin, or a vendor whose item is in the order
exports.getOne = async (req, res, next) => {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const user = req.session.user;
    if (user.role === 'admin') return res.json({ order });
    if (order.user_id === user.id) return res.json({ order });
    if (user.role === 'vendor' && orderModel.belongsToVendor(order.id, user.id)) {
      return res.json({ order });
    }
    res.status(403).json({ message: 'You cannot view this order.' });
  } catch (err) { next(err); }
};

// PUT /api/orders/:id/status - staff only (vendor only for their own orders)
exports.updateStatus = async (req, res, next) => {
  try {
    const user = req.session.user;
    if (user.role === 'vendor' && !orderModel.belongsToVendor(req.params.id, user.id)) {
      return res.status(403).json({ message: 'This order does not contain any of your items.' });
    }
    const order = await orderModel.updateStatus(req.params.id, req.body.status);
    res.json({ order });
  } catch (err) { next(err); }
};
