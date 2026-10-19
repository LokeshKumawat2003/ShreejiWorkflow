require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedAdmin() {
  const isProduction = process.env.NODE_ENV === 'production';
  const name = process.env.ADMIN_NAME || 'Shreeji workflow Admin';
  const email = (isProduction ? process.env.ADMIN_EMAIL || '' : 'admin@gmail.com').trim().toLowerCase();
  const password = isProduction ? process.env.ADMIN_PASSWORD || '' : 'admin123';

  if (!process.env.MONGODB_URI || !email || password.length < 8 || (isProduction && password.length < 12)) {
    throw new Error('Set MONGODB_URI and valid admin credentials. Production passwords must be at least 12 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const existingAdmin = await User.findOne({ email }).select('+password');
  if (existingAdmin) {
    if (isProduction || existingAdmin.role !== 'admin') {
      throw new Error(`An account already exists for ${email}; no changes were made.`);
    }
    existingAdmin.name = name;
    existingAdmin.password = password;
    await existingAdmin.save();
    console.log(`Local admin credentials reset for ${email}.`);
    return;
  }

  await User.create({ name, email, password, role: 'admin' });
  console.log(`Admin account created for ${email}.`);
}

seedAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });