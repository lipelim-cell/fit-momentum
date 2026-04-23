const express = require('express');
const router = express.Router();
const messageHandler = require('../services/whatsapp/messageHandler');
const logger = require('../utils/logger');

// Verificação do webhook (Meta exige isso na configuração)
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('✅ Webhook WhatsApp verificado com sucesso');
    res.status(200).send(challenge);
  } else {
    logger.warn('❌ Falha na verificação do webhook');
    res.sendStatus(403);
  }
});

// Recebimento de mensagens
router.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    // Responder imediatamente (Meta exige 200 em < 5s)
    res.sendStatus(200);

    // Processar mensagens de forma assíncrona
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        for (const message of value.messages || []) {
          const phoneNumber = message.from;
          let content = '';
          let messageType = message.type;

          if (message.type === 'text') {
            content = message.text.body;
          } else if (message.type === 'interactive') {
            const interactive = message.interactive;
            if (interactive.type === 'button_reply') {
              content = interactive.button_reply.id;
            } else if (interactive.type === 'list_reply') {
              content = interactive.list_reply.id;
            }
          } else {
            logger.info(`Tipo de mensagem não suportado: ${message.type}`);
            continue;
          }

          await messageHandler.handleIncomingMessage(phoneNumber, content, messageType);
        }
      }
    }

  } catch (error) {
    logger.error('Erro no webhook WhatsApp:', error);
  }
});

module.exports = router;
