const express = require('express');
const { listNotifications, markAllNotificationsRead, markNotificationRead } = require('../services/notificationService');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'organization'));
router.get('/', async (req, res) => res.json(await listNotifications(req.user)));
router.post('/read-all', async (req, res) => res.json(await markAllNotificationsRead(req.user)));
router.post('/:notificationId/read', async (req, res) => res.json(await markNotificationRead(req.user, req.params.notificationId)));

module.exports = router;
