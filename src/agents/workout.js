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
};

const FEEDBACK_REPLY = {
  ideal: '✅ Perfeito! Continue assim, você está no ritmo certo! 💪',
  facil: '📈 Ótimo! Vou aumentar um pouco a intensidade no próximo treino.',
  dificil: '📉 Entendido! Vou reduzir a intensidade para você se adaptar melhor.',
  muito_facil: '🚀 Excelente! Você está evoluindo muito! Aumentando bastante a intensidade.',
  muito_dificil: '🙏 Tudo bem! Descanse bem hoje. Vou reduzir bastante a intensidade.',
};

class WorkoutAgent {
  async sendTodaysWorkout(user) {
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

    await workoutGenerator.adaptIntensity(user.id, feedback);
    await messageSender.sendText(user.phone, FEEDBACK_REPLY[feedback]);
  }
}

module.exports = new WorkoutAgent();
