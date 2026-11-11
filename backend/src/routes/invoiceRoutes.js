const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  deleteInvoice,
  getInvoiceSetup,
  listInvoices,
  logInvoiceActivity,
  previewInvoice,
  saveInvoice,
  saveInvoiceSetup,
} = require('../services/clientInvoiceService');
const { httpError } = require('../utils/httpError');

const router = express.Router();
const base = '/:organizationId/locations/:locationId';

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(httpError(503, 'The database is not available.'));
  }
  return next();
}

router.use(`${base}/invoice-setup`, requireAuth, requireRole('admin'), requireDatabase);
router.use(`${base}/invoices`, requireAuth, requireRole('admin'), requireDatabase);

router.get(`${base}/invoice-setup`, async (req, res) => (
  res.json(await getInvoiceSetup(req.user, req.params.organizationId, req.params.locationId))
));
router.put(`${base}/invoice-setup`, async (req, res) => (
  res.json(await saveInvoiceSetup(req.user, req.params.organizationId, req.params.locationId, req.body || {}))
));
router.get(`${base}/invoices`, async (req, res) => (
  res.json(await listInvoices(req.user, req.params.organizationId, req.params.locationId))
));
router.get(`${base}/invoices/preview`, async (req, res) => (
  res.json(await previewInvoice(req.user, req.params.organizationId, req.params.locationId, req.query))
));
router.put(`${base}/invoices/:month`, async (req, res) => (
  res.json(await saveInvoice(req.user, req.params.organizationId, req.params.locationId, req.params.month, req.body || {}))
));
router.post(`${base}/invoices/:id/activity`, async (req, res) => (
  res.json(await logInvoiceActivity(req.user, req.params.organizationId, req.params.locationId, req.params.id, req.body || {}))
));
router.delete(`${base}/invoices/:id`, async (req, res) => (
  res.json(await deleteInvoice(req.user, req.params.organizationId, req.params.locationId, req.params.id))
));

module.exports = router;
