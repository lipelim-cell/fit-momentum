require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  console.log('🌱 Inserindo dados de exemplo...\n');

  try {
    // Usuário de teste
    await pool.query(`
      INSERT INTO users (phone, nome, objetivo, nivel, local_treino, dias_semana, plano, status_pagamento, conversation_state, data_vencimento)
      VALUES
        ('5511999990001', 'Ana Silva', 'perder peso', 'iniciante', 'casa sem equipamentos', 3, 'premium', 'ativo', 'active', NOW() + INTERVAL '30 days'),
        ('5511999990002', 'Carlos Santos', 'ganhar massa', 'intermediario', 'academia', 5, 'premium', 'ativo', 'active', NOW() + INTERVAL '30 days'),
        ('5511999990003', 'Maria Oliveira', 'saúde geral', 'iniciante', 'casa com equipamentos', 4, 'basico', 'ativo', 'active', NOW() + INTERVAL '30 days')
      ON CONFLICT (phone) DO NOTHING
    `);
    console.log('✅ Usuários de teste inseridos');

    // Treino de exemplo para o primeiro usuário
    const user = await pool.query("SELECT id FROM users WHERE phone = '5511999990001'");
    if (user.rowCount > 0) {
      const exampleWorkout = {
        titulo: 'Treino Full Body - Iniciante',
        tipo: 'funcional',
        duracao_estimada: '30 minutos',
        calorias_estimadas: 200,
        exercicios: [
          { nome: 'Agachamento', series: '3', repeticoes: '15', descanso_segundos: 60 },
          { nome: 'Flexão no Joelho', series: '3', repeticoes: '10', descanso_segundos: 60 },
          { nome: 'Prancha', series: '3', repeticoes: '30 segundos', descanso_segundos: 45 },
        ],
      };

      await pool.query(`
        INSERT INTO workouts (user_id, data, titulo, exercicios, duracao_estimada, calorias_estimadas)
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
        ON CONFLICT (user_id, data) DO NOTHING
      `, [user.rows[0].id, exampleWorkout.titulo, JSON.stringify(exampleWorkout), exampleWorkout.duracao_estimada, exampleWorkout.calorias_estimadas]);
      console.log('✅ Treino de exemplo inserido');
    }

    console.log('\n✅ Seed concluído!');
    console.log('\nUsuários de teste criados:');
    console.log('  📱 5511999990001 - Ana Silva (Premium)');
    console.log('  📱 5511999990002 - Carlos Santos (Premium)');
    console.log('  📱 5511999990003 - Maria Oliveira (Básico)');
  } catch (error) {
    console.error('❌ Erro no seed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
