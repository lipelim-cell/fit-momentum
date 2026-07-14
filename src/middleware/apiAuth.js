const crypto = require('crypto');
const logger = require('../utils/logger');

function apiAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    logger.error('[apiAuth] ADMIN_API_KEY não configurada — bloqueando acesso a /api');
    return res.status(503).json({ error: 'Serviço indisponível' });
  }

  const providedKey = req.get('x-api-key') || '';
  const adminKeyBuffer = Buffer.from(adminKey);
  const providedKeyBuffer = Buffer.from(providedKey);

  const isValid =
    adminKeyBuffer.length === providedKeyBuffer.length &&
    crypto.timingSafeEqual(adminKeyBuffer, providedKeyBuffer);

  if (!isValid) {
    logger.warn(`[apiAuth] Acesso negado — IP: ${req.ip}`);
    return res.status(401).json({ error: 'Não autorizado' });
  }

  next();
}

module.exports = apiAuth;
