// Wipes every collection except admin user logins.
// Run: node src/scripts/clean-db-keep-admin.js --yes
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  if (!process.argv.includes('--yes')) {
    throw new Error('This deletes all data except admin logins. Run with --yes.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before cleaning.');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Cleaning DB:', db.databaseName);

  const adminsBefore = await User.find({ role: 'admin' }).select('email name status').lean();
  if (!adminsBefore.length) {
    throw new Error('No admin found — aborting to avoid locking yourself out.');
  }
  console.log('Keeping admins:', adminsBefore.map((a) => a.email).join(', '));

  const cols = await db.listCollections().toArray();
  for (const { name } of cols.sort((a, b) => a.name.localeCompare(b.name))) {
    if (name.startsWith('system.')) continue;
    if (name === 'users') {
      const r = await User.deleteMany({ role: { $ne: 'admin' } });
      console.log(`  users (non-admin): ${r.deletedCount} removed`);
      continue;
    }
    const r = await db.collection(name).deleteMany({});
    console.log(`  ${name}: ${r.deletedCount} removed`);
  }

  console.log('\n--- After cleanup ---');
  for (const { name } of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
    const n = await db.collection(name).countDocuments();
    if (n > 0) console.log(`  ${name}: ${n}`);
  }
  const left = await User.find().select('email role name status').lean();
  console.log('Remaining users:', JSON.stringify(left, null, 2));
  console.log('Done. Only admin login(s) kept.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
