const express = require('express');
const { history, list, mark, payroll } = require('../controllers/attendanceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'organization'));
router.get('/history', history);
router.get('/payroll', payroll);
router.get('/', list);
router.put('/', mark);

module.exports = router;