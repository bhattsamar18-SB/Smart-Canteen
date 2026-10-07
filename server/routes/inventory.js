const router = require('express').Router();
const inventory = require('../controllers/inventoryController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', requireAuth, requireAdmin, inventory.list);
router.put('/:id', requireAuth, requireAdmin, inventory.update);

module.exports = router;
