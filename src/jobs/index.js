const cron = require('node-cron');
const db = require('../config/database');
const workoutAgent = require('../agents/workout');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

function initCronJobs() {
  const workoutHour = process.env.WORKOUT_SEND_TIME_HOUR || 6;
  const workoutMin = process.env.WORKOUT_SEND_TIME_MINUTE || 0;
  const feedbackHour = process.env.FEEDBACK_COLLECT_TIME_HOUR || 20;
  const feedbackMin = process.env.FEEDBACK_COLLECT_TIME_MINUTE || 0;

  // Envio de treinos diários
  if (process.env.ENABLE_DAILY_WORKOUTS !== 'false') {
    cron.schedule(`${workoutMin} ${workoutHour} * * *`, sendDailyWorkouts, { timezone: 'America/Sao_Paulo' });
    logger.info(`📅 Cron de treinos configurado: ${workoutHour}:${String(workoutMin).padStart(2, '0')}`);
  }

  // Coleta de feedback
  if (process.env.ENABLE_FEEDBACK_COLLECTION !== 'false') {
    cron.schedule(`${feedbackMin} ${feedbackHour} * * *`, collectFeedback, { timezone: 'America/Sao_Paulo' });
    logger.info(`📅 Cron de feedback configurado: ${feedbackHour}:${String(feedbackMin).padStart(2, '0')}`);
  }

  // Verificação de assinaturas vencidas (todo dia à meia-noite)
  cron.schedule('0 0 * * *', checkExpiredSubscriptions, { timezone: 'America/Sao_Paulo' });

  // Reengajamento de inativos (toda segunda às 9h)
  cron.schedule('0 9 * * 1', reengageInactiveUsers, { timezone: 'America/Sao_Paulo' });
}

async function sendDailyWorkouts() {
  logger.info('🏃 Iniciando envio de treinos diários...');

  try {
    const result = await db.query(
      `SELECT * FROM users
       WHERE conversation_state = 'active'
         AND status_pagamento IN ('ativo', 'teste')
         AND (data_vencimento IS NULL OR data_vencimento > NOW())`
    );

    logger.info(`📤 Enviando treinos para ${result.rowCount} usuários`);

    for (const user of result.rows) {
      try {
        await workoutAgent.sendTodaysWorkout(user);
      } catch (err) {
        logger.error(`[Jobs] Erro ao enviar treino para ${user.phone}:`, err.message);
      }
    }

    logger.info('✅ Envio de treinos concluído');
  } catch (error) {
    logger.error('Erro no job de treinos:', error);
  }
}

async function collectFeedback() {
  logger.info('📊 Coletando feedback dos usuários...');

  try {
    const result = await db.query(
      `SELECT u.* FROM users u
       INNER JOIN workouts w ON w.user_id = u.id AND w.data = CURRENT_DATE
       WHERE u.conversation_state = 'active' AND w.completado = false`
    );

    for (const user of result.rows) {
      try {
        await messageSender.sendText(user.phone,
          `Oi, *${user.nome}*! 👋\n\nVocê conseguiu fazer o treino de hoje?\n\nSeu feedback nos ajuda a melhorar cada treino! 💪`
        );
      } catch (err) {
        logger.error(`Erro ao coletar feedback de ${user.phone}:`, err.message);
      }
    }
  } catch (error) {
    logger.error('Erro no job de feedback:', error);
  }
}

async function checkExpiredSubscriptions() {
  logger.info('🔍 Verificando assinaturas vencidas...');

  try {
    const result = await db.query(
      `UPDATE users
       SET status_pagamento = 'vencido', conversation_state = 'inactive'
       WHERE status_pagamento IN ('ativo', 'teste')
         AND data_vencimento < NOW()
       RETURNING phone, nome`
    );

    for (const user of result.rows) {
      try {
        await messageSender.sendText(user.phone,
          `⚠️ *${user.nome}*, sua assinatura FIT MOMENTUM venceu.\n\n` +
          `Para continuar recebendo seus treinos personalizados, renove seu plano! 💪\n\n` +
          `Digite *PLANOS* para ver as opções.`
        );
      } catch (err) {
        logger.error(`Erro ao notificar vencimento para ${user.phone}:`, err.message);
      }
    }

    logger.info(`✅ ${result.rowCount} assinaturas marcadas como vencidas`);
  } catch (error) {
    logger.error('Erro no job de assinaturas:', error);
  }
}

async function reengageInactiveUsers() {
  logger.info('💬 Reengajando usuários inativos...');

  try {
    const result = await db.query(
      `SELECT * FROM users
       WHERE last_interaction < NOW() - INTERVAL '7 days'
         AND conversation_state = 'active'`
    );

    for (const user of result.rows) {
      try {
        await messageSender.sendText(user.phone,
          `Olá, *${user.nome}*! Sentimos sua falta! 😊\n\n` +
          `Faz uns dias que você não treina. Que tal retomar hoje?\n\n` +
          `Digite *TREINO* para receber seu treino do dia! 💪`
        );
      } catch (err) {
        logger.error(`Erro ao reengajar ${user.phone}:`, err.message);
      }
    }
  } catch (error) {
    logger.error('Erro no job de reengajamento:', error);
  }
}

module.exports = { initCronJobs };
