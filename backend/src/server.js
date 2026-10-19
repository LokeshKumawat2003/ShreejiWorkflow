require('dotenv').config();
const { createApp } = require('./app');
const { connectDatabase } = require('./config/database');

const port = Number(process.env.PORT) || 5000;
const app = createApp();

function listen() {
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

connectDatabase()
  .then((connected) => {
    if (!connected) {
      console.warn('MONGODB_URI is not configured; authentication routes are unavailable.');
    }
    listen();
  })
  .catch((error) => {
    console.error(`Database connection failed: ${error.message}`);
    listen();
  });