const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

const ONBOARDING_STATES = new Set([
  'new', 'awaiting_name', 'awaiting_objective',
  'awaiting_level', 'awaiting_location', 'awaiting_frequency', 'awaiting_plan_choice'
]);

class OrchestratorAgent {
  async handle(phoneNumber, message, messageType = 'text') {
    try {
      logger.info(`📨 [Orchestrator] de ${phoneNumber}: ${message}`);

      const user = await this._findOrCreateUser(phoneNumber);
      await this._touchUser(user.id);

      // Lazy-require para evitar circular dependency
      const workoutAgent = require('./workout');
      const progressAgent = require('./progress');
      const subscriptionAgent = require('./subscription');
      const onboardingAgent = require('./onboarding');

      // Comandos globais (funcionam em qualquer estado)
      const cmd = message.toLowerCase().trim();

      if (cmd === 'ajuda' || cmd === 'help') {
        return await this._sendHelp(phoneNumber);
      }
      if (cmd === 'planos') {
        return await subscriptionAgent.presentPlans(phoneNumber);
      }
      if (cmd === 'progresso' && user.conversation_state === 'active') {
        return await progressAgent.sendReport(user);
      }
      if (cmd === 'treino' && user.conversation_state === 'active') {
        return await workoutAgent.sendTodaysWorkout(user);
      }

      // Roteamento por estado
      if (ONBOARDING_STATES.has(user.conversation_state)) {
        return await onboardingAgent.handle(user, message, messageType);
      }

      if (user.conversation_state === 'active') {
        return await this._handleActive(user, message);
      }

      if (user.conversation_state === 'inactive') {
        return await subscriptionAgent.handleReactivation(user);
      }

      // Estado desconhecido — reinicia onboarding
      logger.warn(`[Orchestrator] Estado desconhecido '${user.conversation_state}' para user ${user.id}, reiniciando`);
      await db.query("UPDATE users SET conversation_state = 'new' WHERE id = $1", [user.id]);
      return await onboardingAgent.handle({ ...user, conversation_state: 'new' }, message, messageType);

    } catch (error) {
      logger.error('[Orchestrator] Erro não tratado:', error);
      await messageSender.sendText(phoneNumber,
        '❌ Ocorreu um erro inesperado. Tente novamente em instantes.\n\nSe persistir, digite *AJUDA*.'
      );
    }
  }

  async _handleActive(user, message) {
    const workoutAgent = require('./workout');
    const progressAgent = require('./progress');

    const msg = message.toLowerCase();

    if (msg.includes('treino')) return await workoutAgent.sendTodaysWorkout(user);
    if (msg.includes('progresso')) return await progressAgent.sendReport(user);

    // Feedback de treino vem como button_reply id
    if (message.startsWith('feedback_')) return await workoutAgent.handleFeedback(user, message);

    await messageSender.sendText(user.phone,
      `Olá, *${user.nome}*! 👋\n\n` +
      `Digite:\n` +
      `• *TREINO* — receber treino do dia\n` +
      `• *PROGRESSO* — ver suas estatísticas\n` +
      `• *PLANOS* — ver planos disponíveis\n` +
      `• *AJUDA* — todos os comandos`
    );
  }

  async _findOrCreateUser(phone) {
    const r = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (r.rows.length > 0) return r.rows[0];

    const created = await db.query(
      "INSERT INTO users (phone, conversation_state, created_at) VALUES ($1, 'new', NOW()) RETURNING *",
      [phone]
    );
    logger.info(`👤 Novo usuário criado: ${phone}`);
    return created.rows[0];
  }

  async _touchUser(userId) {
    await db.query('UPDATE users SET last_interaction = NOW() WHERE id = $1', [userId]);
  }

  async _sendHelp(phone) {
    await messageSender.sendText(phone,
      `📖 *COMANDOS FIT MOMENTUM*\n\n` +
      `• *TREINO* — treino do dia\n` +
      `• *PROGRESSO* — suas estatísticas\n` +
      `• *PLANOS* — ver planos disponíveis\n` +
      `• *AJUDA* — esta mensagem\n\n` +
      `💬 Ou converse comigo normalmente!`
    );
  }
}

module.exports = new OrchestratorAgent();
