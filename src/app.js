require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rotas
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'fit-momentum' });
});

// Error handling
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`🚀 Fit Momentum rodando na porta ${PORT}`);
  
  // Iniciar cron jobs
  initCronJobs();
  logger.info('✅ Cron jobs inicializados');
});

module.exports = app;
