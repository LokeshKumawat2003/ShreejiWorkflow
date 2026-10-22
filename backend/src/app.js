const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const locationRoutes = require('./routes/locationRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');
const organizationRoutes = require('./routes/organizationRoutes');

function createApp() {
  const app = express();
  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

  app.use(cors({
    origin(origin, callback) {
      const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
        && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
      if (!origin || origin === allowedOrigin || isLocalDevelopmentOrigin) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    },
  }));
  const defaultJsonParser = express.json({ limit: '10kb' });
  const bulkAttendanceJsonParser = express.json({ limit: '512kb' });
  app.use((req, res, next) => (
    req.path === '/api/attendance/bulk' ? bulkAttendanceJsonParser : defaultJsonParser
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
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/master-data', masterDataRoutes);
  app.use('/api/organizations', locationRoutes);
  app.use('/api/organizations', organizationRoutes);

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