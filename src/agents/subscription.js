const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

const PLAN_MAP = {
  'plan_premium': 'premium',
  'plan_basico': 'basico',
  'plan_teste': 'teste',
};

const PLAN_PRICE = { premium: 97, basico: 49 };

class SubscriptionAgent {
  async presentPlans(phone) {
    await messageSender.sendText(phone,
      `💎 *PLANOS FIT MOMENTUM*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⭐ *PREMIUM* — R$ 97/mês\n` +
      `✓ Treino 100% personalizado\n` +
      `✓ Ajustes automáticos por feedback\n` +
      `✓ Plano nutricional básico\n` +
      `✓ Check-ins semanais\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💙 *BÁSICO* — R$ 49/mês\n` +
      `✓ Treino semanal padronizado\n` +
      `✓ Dicas de hábitos saudáveis\n` +
      `✓ Grupo de apoio\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎁 *TESTE GRÁTIS* — 3 dias\n` +
      `✓ Experimente o Premium sem compromisso\n\n` +
      `━━━━━━━━━━━━━━━━`
    );

    await messageSender.sendInteractiveButtons(phone,
      'Escolha seu plano:',
      [
        { id: 'plan_premium', title: '⭐ PREMIUM' },
        { id: 'plan_basico', title: '💙 BÁSICO' },
        { id: 'plan_teste', title: '🎁 TESTE GRÁTIS' },
      ]
    );
  }

  async processPlanChoice(user, buttonId) {
    const plano = PLAN_MAP[buttonId] || buttonId;
    logger.info(`[Subscription] Plano '${plano}' escolhido por user ${user.id}`);

    if (plano === 'teste') {
      await db.query(
        `UPDATE users SET
           plano = 'premium',
           status_pagamento = 'teste',
           data_inicio = NOW(),
           data_vencimento = NOW() + INTERVAL '3 days',
           conversation_state = 'active'
         WHERE id = $1`,
        [user.id]
      );

      await messageSender.sendText(user.phone,
        `🎉 *Teste Grátis Ativado!*\n\n` +
        `Você tem *3 dias* para experimentar o plano Premium!\n\n` +
        `Amanhã às 6h você receberá seu primeiro treino personalizado. 💪\n\n` +
        `Digite *TREINO* a qualquer momento para receber seu treino agora!`
      );
      return;
    }

    const valor = PLAN_PRICE[plano] || 0;

    await db.query(
      'UPDATE users SET plano = $1, status_pagamento = $2 WHERE id = $3',
      [plano, 'pending', user.id]
    );

    await messageSender.sendText(user.phone,
      `✅ *Plano ${plano.toUpperCase()} selecionado!*\n\n` +
      `💰 Valor: *R$ ${valor}/mês*\n\n` +
      `📲 Realize o PIX para a chave:\n*financeiro@fitmomentum.com.br*\n\n` +
      `Após o pagamento, envie o comprovante aqui para liberarmos seu acesso! 🚀`
    );
  }

  async handleReactivation(user) {
    logger.info(`[Subscription] Reativação solicitada por user ${user.id}`);

    await messageSender.sendText(user.phone,
      `Olá, *${user.nome || 'atleta'}*! 👋\n\n` +
      `Sua assinatura está inativa. Para voltar a treinar, escolha um plano:\n\n` +
      `Digite *PLANOS* para ver as opções disponíveis. 💪`
    );
  }
}

module.exports = new SubscriptionAgent();
