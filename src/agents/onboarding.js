const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

const OBJECTIVE_MAP = {
  'obj_perder': 'perder peso',
  'obj_ganhar': 'ganhar massa',
  'obj_definir': 'definição',
  'obj_saude': 'saúde geral',
};

const LEVEL_MAP = {
  'nv_iniciante': 'iniciante',
  'nv_intermediario': 'intermediario',
  'nv_avancado': 'avancado',
};

const LOCATION_MAP = {
  'loc_academia': 'academia',
  'loc_casa_equip': 'casa com equipamentos',
  'loc_casa_sem': 'casa sem equipamentos',
};

const FREQUENCY_MAP = {
  'freq_3': 3, 'freq_4': 4, 'freq_5': 5, 'freq_6': 6,
};

class OnboardingAgent {
  async handle(user, message) {
    logger.info(`[Onboarding] state=${user.conversation_state} user=${user.id}`);

    switch (user.conversation_state) {
      case 'new':              return await this._start(user);
      case 'awaiting_name':   return await this._collectName(user, message);
      case 'awaiting_objective': return await this._collectObjective(user, message);
      case 'awaiting_level':  return await this._collectLevel(user, message);
      case 'awaiting_location': return await this._collectLocation(user, message);
      case 'awaiting_frequency': return await this._collectFrequency(user, message);
      case 'awaiting_plan_choice': {
        const subscriptionAgent = require('./subscription');
        return await subscriptionAgent.processPlanChoice(user, message);
      }
      default:
        logger.warn(`[Onboarding] estado inesperado: ${user.conversation_state}`);
    }
  }

  async _start(user) {
    await messageSender.sendText(user.phone,
      `👋 *Olá! Bem-vindo ao FIT MOMENTUM!*\n\n` +
      `Eu sou seu Personal Trainer com Inteligência Artificial! 🤖💪\n\n` +
      `Vou criar treinos 100% personalizados para você, com dicas de cada exercício.\n\n` +
      `Primeiro, qual é o seu *nome*?`
    );
    await this._setState(user.id, 'awaiting_name');
  }

  async _collectName(user, name) {
    const trimmed = name.trim();
    await db.query('UPDATE users SET nome = $1 WHERE id = $2', [trimmed, user.id]);

    await messageSender.sendInteractiveButtons(user.phone,
      `Prazer, *${trimmed}*! 😊\n\nQual seu principal *objetivo*?`,
      [
        { id: 'obj_perder', title: '🔵 Perder peso' },
        { id: 'obj_ganhar', title: '💪 Ganhar massa' },
        { id: 'obj_definir', title: '⚡ Definição' },
        { id: 'obj_saude', title: '❤️ Saúde geral' },
      ]
    );
    await this._setState(user.id, 'awaiting_objective');
  }

  async _collectObjective(user, buttonId) {
    const objetivo = OBJECTIVE_MAP[buttonId] || buttonId;
    await db.query('UPDATE users SET objetivo = $1 WHERE id = $2', [objetivo, user.id]);

    await messageSender.sendInteractiveButtons(user.phone,
      'Qual seu *nível* de experiência com treinos?',
      [
        { id: 'nv_iniciante', title: '🌱 Iniciante' },
        { id: 'nv_intermediario', title: '📈 Intermediário' },
        { id: 'nv_avancado', title: '🏆 Avançado' },
      ]
    );
    await this._setState(user.id, 'awaiting_level');
  }

  async _collectLevel(user, buttonId) {
    const nivel = LEVEL_MAP[buttonId] || buttonId;
    await db.query('UPDATE users SET nivel = $1 WHERE id = $2', [nivel, user.id]);

    await messageSender.sendInteractiveButtons(user.phone,
      'Onde você vai *treinar*?',
      [
        { id: 'loc_academia', title: '🏋️ Academia' },
        { id: 'loc_casa_equip', title: '🏠 Casa c/ equipamentos' },
        { id: 'loc_casa_sem', title: '🧘 Casa sem equip.' },
      ]
    );
    await this._setState(user.id, 'awaiting_location');
  }

  async _collectLocation(user, buttonId) {
    const local = LOCATION_MAP[buttonId] || buttonId;
    await db.query('UPDATE users SET local_treino = $1 WHERE id = $2', [local, user.id]);

    await messageSender.sendInteractiveButtons(user.phone,
      'Quantos dias por semana você consegue *treinar*?',
      [
        { id: 'freq_3', title: '3️⃣ dias' },
        { id: 'freq_4', title: '4️⃣ dias' },
        { id: 'freq_5', title: '5️⃣ dias' },
        { id: 'freq_6', title: '6️⃣ dias' },
      ]
    );
    await this._setState(user.id, 'awaiting_frequency');
  }

  async _collectFrequency(user, buttonId) {
    const dias = FREQUENCY_MAP[buttonId] || parseInt(buttonId) || 3;
    await db.query('UPDATE users SET dias_semana = $1 WHERE id = $2', [dias, user.id]);

    // Buscar dados completos para exibir resumo
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
    const u = rows[0];

    await messageSender.sendText(user.phone,
      `✅ *Perfeito, ${u.nome}!*\n\n` +
      `Aqui está seu perfil:\n` +
      `🎯 Objetivo: *${u.objetivo}*\n` +
      `📈 Nível: *${u.nivel}*\n` +
      `📍 Local: *${u.local_treino}*\n` +
      `📅 Frequência: *${u.dias_semana}x por semana*\n\n` +
      `Agora vou te mostrar os planos disponíveis! 💪`
    );

    await new Promise(r => setTimeout(r, 1500));

    const subscriptionAgent = require('./subscription');
    await subscriptionAgent.presentPlans(user.phone);
    await this._setState(user.id, 'awaiting_plan_choice');
  }

  async _setState(userId, state) {
    await db.query('UPDATE users SET conversation_state = $1 WHERE id = $2', [state, userId]);
  }
}

module.exports = new OnboardingAgent();
