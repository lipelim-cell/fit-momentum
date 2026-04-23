require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const logger = require('./utils/logger');
const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================================
// MIDDLEWARE
// ==================================

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging de requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ==================================
// ROTAS
// ==================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'fit-momentum',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: '🏋️ Fit Momentum API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/webhook/whatsapp',
      api: '/api/*'
    }
  });
});

// Rotas de webhook
app.use('/webhook', webhookRoutes);

// Rotas da API
app.use('/api', apiRoutes);

// ==================================
// ERROR HANDLING
// ==================================

// 404 - Not Found
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`
  });
});

// Error handler global
app.use(errorHandler);

// ==================================
// INICIALIZAÇÃO
// ==================================

const server = app.listen(PORT, () => {
  logger.info(`🚀 Fit Momentum rodando na porta ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Iniciar cron jobs apenas em produção
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DAILY_WORKOUTS === 'true') {
    initCronJobs();
    logger.info('✅ Cron jobs inicializados');
  } else {
    logger.info('⏸️  Cron jobs desabilitados (development mode)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, fechando servidor...');
  server.close(() => {
    logger.info('Servidor fechado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido, fechando servidor...');
  server.close(() => {
    logger.info('Servidor fechado');
    process.exit(0);
  });
});

module.exports = app;
