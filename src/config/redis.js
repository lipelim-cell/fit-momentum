const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

// Criar cliente Redis apenas se URL estiver configurada
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: process.env.NODE_ENV === 'production',
      rejectUnauthorized: false
    }
  });

  // Event listeners
  redisClient.on('connect', () => {
    logger.info('✅ Redis conectado');
  });

  redisClient.on('error', (err) => {
    logger.error('❌ Erro no Redis:', err);
  });

  redisClient.on('ready', () => {
    logger.info('Redis pronto para uso');
  });

  // Conectar
  redisClient.connect().catch((err) => {
    logger.error('Erro ao conectar no Redis:', err);
    redisClient = null; // Desabilitar se falhar
  });
} else {
  logger.warn('⚠️  Redis não configurado (REDIS_URL não definido). Cache desabilitado.');
}

// Helper para cache
const cache = {
  get: async (key) => {
    if (!redisClient) return null;
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Erro ao ler cache:', error);
      return null;
    }
  },

  set: async (key, value, ttl = 3600) => {
    if (!redisClient) return false;
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Erro ao salvar cache:', error);
      return false;
    }
  },

  del: async (key) => {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error('Erro ao deletar cache:', error);
      return false;
    }
  },

  flush: async () => {
    if (!redisClient) return false;
    try {
      await redisClient.flushAll();
      logger.info('Cache limpo');
      return true;
    } catch (error) {
      logger.error('Erro ao limpar cache:', error);
      return false;
    }
  }
};

module.exports = { redisClient, cache };
