const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

const PLAN_MAP = {
  'plan_premium': 'premium',
  'plan_basico': 'basico',
  'plan_teste': 'teste',
};

const PLAN_PRICE = { premium: 97, basico: 49 };
const PIX_KEY = 'financeiro@fitmomentum.com.br';

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
    const plano = PLAN_MAP[buttonId];

    if (!plano) {
      logger.info(`[Subscription] Escolha inválida '${buttonId}' por user ${user.id}`);
      await messageSender.sendText(user.phone, 'Não entendi 🤔 Escolha um dos planos abaixo:');
      return await this.presentPlans(user.phone);
    }

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

    const valor = PLAN_PRICE[plano];

    await db.query(
      `UPDATE users SET plano = $1, status_pagamento = $2, conversation_state = $3 WHERE id = $4`,
      [plano, 'pending', 'pending_payment', user.id]
    );

    await messageSender.sendText(user.phone,
      `✅ *Plano ${plano.toUpperCase()} selecionado!*\n\n` +
      `💰 Valor: *R$ ${valor}/mês*\n\n` +
      `📲 Realize o PIX para a chave:\n*${PIX_KEY}*\n\n` +
      `Após o pagamento, envie o comprovante aqui para liberarmos seu acesso! 🚀`
    );
  }

  /**
   * Trata mensagens recebidas enquanto o usuário está em `pending_payment`.
   */
  async handlePendingPayment(user, content, messageType) {
    if (messageType === 'image' || messageType === 'document') {
      return await this._receivePaymentProof(user, content);
    }

    const valor = PLAN_PRICE[user.plano] || 0;
    await messageSender.sendText(user.phone,
      `⏳ Ainda aguardando a confirmação do seu pagamento.\n\n` +
      `📲 Chave PIX: *${PIX_KEY}*\n` +
      `💰 Valor: *R$ ${valor}/mês*\n\n` +
      `Assim que enviar o comprovante (foto ou PDF), vou avisar o time e liberar seu acesso. 🚀`
    );
  }

  async _receivePaymentProof(user, mediaId) {
    const valor = PLAN_PRICE[user.plano] || 0;

    await db.query(
      `INSERT INTO payments (user_id, plano, valor, status, provider, provider_id)
       VALUES ($1, $2, $3, 'pending', 'pix_manual', $4)`,
      [user.id, user.plano, valor, mediaId]
    );

    await messageSender.sendText(user.phone,
      '📄 Comprovante recebido! Vamos confirmar o pagamento e liberar seu acesso em breve. ✅'
    );

    if (!process.env.ADMIN_PHONE) {
      logger.warn('[Subscription] ADMIN_PHONE não configurado — notificação de comprovante não enviada');
      return;
    }

    await messageSender.sendText(process.env.ADMIN_PHONE,
      `💰 *Novo comprovante recebido*\n\n` +
      `👤 Nome: ${user.nome || 'N/A'}\n` +
      `📱 Telefone: ${user.phone}\n` +
      `📦 Plano: ${user.plano}\n` +
      `💵 Valor: R$ ${valor}/mês\n\n` +
      `Libere o acesso: POST /api/users/${user.id}/activate`
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
