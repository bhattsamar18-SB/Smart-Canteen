const router = require('express').Router();
const users = require('../controllers/userController');
const { requireSuperAdmin } = require('../middleware/auth');

// Everything here is administrator-only.
router.use(requireSuperAdmin);
router.get('/', users.list);
router.post('/', users.create);
router.put('/:id', users.update);
router.delete('/:id', users.remove);

module.exports = router;
