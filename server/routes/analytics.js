const router = require('express').Router();
const analytics = require('../controllers/analyticsController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);
router.get('/summary', analytics.summary);
router.get('/daily', analytics.series('daily'));
router.get('/weekly', analytics.series('weekly'));
router.get('/monthly', analytics.series('monthly'));
router.get('/popular', analytics.popular);
router.get('/category', analytics.categoryRevenue);
router.get('/sales', analytics.sales);

module.exports = router;
