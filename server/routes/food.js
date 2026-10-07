const router = require('express').Router();
const food = require('../controllers/foodController');
const { requireAdmin, requireAuth } = require('../middleware/auth');

router.get('/', food.list);
router.get('/:id', food.getOne);
router.post('/', requireAuth, requireAdmin, food.create);
router.put('/:id', requireAuth, requireAdmin, food.update);
router.delete('/:id', requireAuth, requireAdmin, food.remove);

module.exports = router;
