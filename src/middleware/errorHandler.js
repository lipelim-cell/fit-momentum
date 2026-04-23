const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Erro não tratado:', { message: err.message, stack: err.stack, url: req.url });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
