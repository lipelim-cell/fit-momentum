try { require('dotenv').config(); const app = require('./src/app.js'); } catch(e) { console.error('ERRO:', e.message); console.error(e.stack); process.exit(1); }
