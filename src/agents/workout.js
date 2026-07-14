const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const workoutGenerator = require('../services/ai/workoutGenerator');
const logger = require('../utils/logger');

const FEEDBACK_MAP = {
  'feedback_ideal': 'ideal',
  'feedback_facil': 'facil',
  'feedback_dificil': 'dificil',
  'feedback_muito_facil': 'muito_facil',
  'feedback_muito_dificil': 'muito_dificil',
  'feedback_nao_fiz': 'nao_fiz',
};

const FEEDBACK_REPLY = {
  ideal: '✅ Perfeito! Continue assim, você está no ritmo certo! 💪',
  facil: '📈 Ótimo! Vou aumentar um pouco a intensidade no próximo treino.',
  dificil: '📉 Entendido! Vou reduzir a intensidade para você se adaptar melhor.',
  muito_facil: '🚀 Excelente! Você está evoluindo muito! Aumentando bastante a intensidade.',
  muito_dificil: '🙏 Tudo bem! Descanse bem hoje. Vou reduzir bastante a intensidade.',
  nao_fiz: 'Tudo bem, acontece! Amanhã tem treino novo te esperando 💪',
};

class WorkoutAgent {
  async sendTodaysWorkout(user) {
    const existing = await db.query(
      'SELECT exercicios FROM workouts WHERE user_id = $1 AND data = CURRENT_DATE',
      [user.id]
    );

    if (existing.rows.length > 0) {
      logger.info(`[Workout] Reenviando treino já existente para user ${user.id}`);
      const workout = existing.rows[0].exercicios;
      await messageSender.sendText(user.phone, '🔁 Reenviando seu treino de hoje:');
      await messageSender.sendWorkout(user.phone, workout);
      return;
    }

    logger.info(`[Workout] Gerando treino para user ${user.id}`);

    await messageSender.sendText(user.phone,
      '⚡ Gerando seu treino personalizado...\n\nAguarde alguns segundos! 🤖'
    );

    const workout = await workoutGenerator.generatePersonalizedWorkout(user);
    await messageSender.sendWorkout(user.phone, workout);

    await db.query(
      `INSERT INTO workouts (user_id, data, titulo, exercicios, duracao_estimada, calorias_estimadas)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
       ON CONFLICT (user_id, data) DO NOTHING`,
      [user.id, workout.titulo, JSON.stringify(workout), workout.duracao_estimada, workout.calorias_estimadas]
    );

    logger.info(`[Workout] Treino enviado e salvo para user ${user.id}`);
  }

  async handleFeedback(user, feedbackId) {
    const feedback = FEEDBACK_MAP[feedbackId];
    if (!feedback) {
      logger.warn(`[Workout] Feedback desconhecido: ${feedbackId}`);
      return;
    }

    logger.info(`[Workout] Feedback '${feedback}' de user ${user.id}`);

    if (feedback === 'nao_fiz') {
      await db.query(
        `UPDATE workouts SET feedback = $1, updated_at = NOW()
         WHERE user_id = $2 AND data = CURRENT_DATE`,
        [feedback, user.id]
      );
      await messageSender.sendText(user.phone, FEEDBACK_REPLY[feedback]);
      return;
    }

    await workoutGenerator.adaptIntensity(user.id, feedback);

    // CTE captura o valor de `completado` anterior ao UPDATE, na mesma transação —
    // evita duas leituras separadas (race condition se dois feedbacks chegarem juntos).
    const updateResult = await db.query(
      `WITH old AS (
         SELECT completado FROM workouts WHERE user_id = $2 AND data = CURRENT_DATE
       )
       UPDATE workouts
       SET completado = true, feedback = $1, updated_at = NOW()
       WHERE user_id = $2 AND data = CURRENT_DATE
       RETURNING (SELECT completado FROM old) AS was_completed`,
      [feedback, user.id]
    );

    let streakMsg = '';

    if (updateResult.rows.length > 0 && updateResult.rows[0].was_completed !== true) {
      const { rows } = await db.query(
        `SELECT (MAX(data) = CURRENT_DATE - 1) AS foi_ontem
         FROM workouts
         WHERE user_id = $1 AND completado = true AND data < CURRENT_DATE`,
        [user.id]
      );

      const foiOntem = rows[0]?.foi_ontem === true;
      const streak = foiOntem ? (parseInt(user.current_streak) || 0) + 1 : 1;

      await db.query(
        'UPDATE users SET current_streak = $1, updated_at = NOW() WHERE id = $2',
        [streak, user.id]
      );

      if (streak >= 2) {
        streakMsg = `\n\n🔥 Você está há *${streak} dias* seguidos treinando!`;
      }
    }

    await messageSender.sendText(user.phone, FEEDBACK_REPLY[feedback] + streakMsg);
  }
}

module.exports = new WorkoutAgent();
