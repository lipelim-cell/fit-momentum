const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuração do pool de conexões PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Event listeners
pool.on('connect', () => {
  logger.debug('Nova conexão PostgreSQL estabelecida');
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool PostgreSQL:', err);
  process.exit(-1);
});

// Testar conexão na inicialização
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('❌ Erro ao conectar no PostgreSQL:', err);
  } else {
    logger.info('✅ PostgreSQL conectado:', res.rows[0].now);
  }
});

// Helper para executar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executada', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Erro na query:', { text, error: error.message });
    throw error;
  }
};

// Helper para transações
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  transaction
};
