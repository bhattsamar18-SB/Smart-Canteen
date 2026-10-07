const router = require('express').Router();
const orders = require('../controllers/orderController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.post('/', requireAuth, orders.create);
router.get('/', requireAuth, orders.list);
router.get('/:id', requireAuth, orders.getOne);
router.put('/:id/status', requireAuth, requireAdmin, orders.updateStatus);

module.exports = router;
