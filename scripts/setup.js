require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('redis');

async function setup() {
  console.log('🚀 FIT MOMENTUM - Verificação de configuração\n');
  let allOk = true;

  // Variáveis obrigatórias
  const required = ['DATABASE_URL', 'ANTHROPIC_API_KEY'];
  const optional = ['REDIS_URL', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'];

  console.log('📋 Variáveis de ambiente:');
  for (const key of required) {
    if (process.env[key]) {
      console.log(`  ✅ ${key}`);
    } else {
      console.log(`  ❌ ${key} — OBRIGATÓRIA`);
      allOk = false;
    }
  }
  for (const key of optional) {
    console.log(`  ${process.env[key] ? '✅' : '⚠️ '} ${key}${!process.env[key] ? ' (opcional)' : ''}`);
  }

  // Testar PostgreSQL
  console.log('\n🐘 Testando PostgreSQL...');
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    const res = await pool.query('SELECT NOW()');
    console.log(`  ✅ Conectado! Hora do servidor: ${res.rows[0].now}`);
    await pool.end();
  } catch (err) {
    console.log(`  ❌ Falha: ${err.message}`);
    allOk = false;
  }

  // Testar Redis (opcional)
  if (process.env.REDIS_URL) {
    console.log('\n📦 Testando Redis...');
    try {
      const client = createClient({ url: process.env.REDIS_URL });
      await client.connect();
      await client.ping();
      console.log('  ✅ Redis conectado!');
      await client.disconnect();
    } catch (err) {
      console.log(`  ⚠️  Redis falhou (não obrigatório): ${err.message}`);
    }
  }

  console.log('\n' + '─'.repeat(40));
  if (allOk) {
    console.log('✅ Configuração OK! Execute: npm run migrate && npm run seed && npm run dev');
  } else {
    console.log('❌ Corrija as variáveis faltantes no arquivo .env antes de continuar.');
    process.exit(1);
  }
}

setup().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
