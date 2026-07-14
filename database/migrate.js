require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const migrations = [
  {
    name: 'create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id                 SERIAL PRIMARY KEY,
        phone              VARCHAR(20) UNIQUE NOT NULL,
        nome               VARCHAR(100),
        objetivo           VARCHAR(50),
        nivel              VARCHAR(20) DEFAULT 'iniciante',
        local_treino       VARCHAR(50),
        dias_semana        INTEGER DEFAULT 3,
        restricoes         TEXT,
        plano              VARCHAR(20) DEFAULT 'none',
        status_pagamento   VARCHAR(20) DEFAULT 'pendente',
        data_inicio        TIMESTAMP,
        data_vencimento    TIMESTAMP,
        conversation_state VARCHAR(50) DEFAULT 'new',
        intensity_level    DECIMAL(3,2) DEFAULT 1.00,
        current_streak     INTEGER DEFAULT 0,
        last_interaction   TIMESTAMP DEFAULT NOW(),
        created_at         TIMESTAMP DEFAULT NOW(),
        updated_at         TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_state ON users(conversation_state);
      CREATE INDEX IF NOT EXISTS idx_users_vencimento ON users(data_vencimento);
    `,
  },
  {
    name: 'create_workouts',
    sql: `
      CREATE TABLE IF NOT EXISTS workouts (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data                DATE NOT NULL DEFAULT CURRENT_DATE,
        titulo              VARCHAR(200),
        exercicios          JSONB,
        duracao_estimada    VARCHAR(50),
        calorias_estimadas  INTEGER,
        completado          BOOLEAN DEFAULT FALSE,
        feedback            VARCHAR(30),
        created_at          TIMESTAMP DEFAULT NOW(),
        updated_at          TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, data)
      );
      CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
      CREATE INDEX IF NOT EXISTS idx_workouts_data ON workouts(data);
    `,
  },
  {
    name: 'create_payments',
    sql: `
      CREATE TABLE IF NOT EXISTS payments (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plano            VARCHAR(20) NOT NULL,
        valor            DECIMAL(10,2) NOT NULL,
        status           VARCHAR(20) DEFAULT 'pending',
        provider         VARCHAR(20),
        provider_id      VARCHAR(200),
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    `,
  },
  {
    name: 'create_processed_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id    VARCHAR(255) PRIMARY KEY,
        processed_at  TIMESTAMP DEFAULT NOW()
      );
    `,
  },
];

async function migrate() {
  console.log('🔄 Iniciando migrations...\n');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const exists = await pool.query('SELECT id FROM migrations WHERE name = $1', [migration.name]);
    if (exists.rowCount > 0) {
      console.log(`⏭️  Já aplicada: ${migration.name}`);
      continue;
    }

    try {
      await pool.query('BEGIN');
      await pool.query(migration.sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      await pool.query('COMMIT');
      console.log(`✅ Aplicada: ${migration.name}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`❌ Erro em ${migration.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✅ Migrations concluídas!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
