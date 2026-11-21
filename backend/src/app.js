const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const assistantRoutes = require('./routes/assistantRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

function resolveFrontendDist() {
  if (process.env.FRONTEND_DIST) {
    return path.resolve(process.env.FRONTEND_DIST);
  }
  return path.resolve(__dirname, '../../frontend/dist');
}

function isAllowedOrigin(origin, req) {
  if (!origin) return true;

  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
  if (origin === allowedOrigin) return true;

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin === requestOrigin) return true;

  const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return isLocalDevelopmentOrigin;
}

function createApp() {
  const app = express();
  const frontendDist = resolveFrontendDist();
  const serveFrontend = fs.existsSync(path.join(frontendDist, 'index.html'));
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY || '', 10);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: serveFrontend
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
          },
        }
      : {
          useDefaults: false,
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
  }));

  app.use((req, res, next) => {
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin, req)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS.'));
      },
      credentials: true,
    })(req, res, next);
  });
  const defaultJsonParser = express.json({ limit: '10kb' });
  const bulkAttendanceJsonParser = express.json({ limit: '512kb' });
  const largeJsonPaths = new Set(['/api/attendance/bulk', '/api/attendance/sheet']);
  app.use((req, res, next) => (
    largeJsonPaths.has(req.path) ? bulkAttendanceJsonParser : defaultJsonParser
  )(req, res, next));
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
  });
  app.use('/api/assistant', assistantRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/master-data', masterDataRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/organizations', invoiceRoutes);
  app.use('/api/organizations', locationRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/tickets', ticketRoutes);

  if (serveFrontend) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    // SPA fallback for client routes; API 404s still fall through below.
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
      res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((req, res, next) => {
    const error = new Error('Route not found.');
    error.statusCode = 404;
    next(error);
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    const statusCode = error.statusCode || (error.code === 11000 ? 409 : 500);
    const message = error.code === 11000
      ? error.keyPattern?.email
        ? 'An account with this email already exists.'
        : error.keyPattern?.employeeId && error.keyPattern?.date
          ? 'Attendance for this employee and date has already been recorded.'
          : 'A record with these details already exists.'
      : statusCode === 500
        ? 'An unexpected error occurred.'
        : error.message;
    return res.status(statusCode).json({ message });
  });

  return app;
}

module.exports = { createApp };