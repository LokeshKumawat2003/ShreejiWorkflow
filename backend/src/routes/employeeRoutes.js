const express = require('express');
const { assign, create, get, list, remove, unassign, update } = require('../controllers/employeeController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'organization'));
router.get('/', list);
router.post('/', create);
router.post('/assign', assign);
router.post('/unassign', unassign);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;