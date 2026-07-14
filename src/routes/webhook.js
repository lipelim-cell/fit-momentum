const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const orchestrator = require('../agents/orchestrator');
const db = require('../config/database');
const logger = require('../utils/logger');

if (!process.env.META_APP_SECRET) {
  logger.error('[Webhook] META_APP_SECRET não configurado — validação de assinatura desativada (apenas fora de produção)');
}

function isValidSignature(req, secret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

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
  const secret = process.env.META_APP_SECRET;

  if (secret) {
    if (!isValidSignature(req, secret)) {
      logger.warn(`❌ Assinatura de webhook inválida — IP: ${req.ip}`);
      return res.sendStatus(401);
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('[Webhook] META_APP_SECRET ausente em produção — recusando webhook');
    return res.sendStatus(503);
  }

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      logger.warn('object inesperado: ' + body.object);
      return res.sendStatus(404);
    }

    const messageTypes = (body.entry || [])
      .flatMap(entry => entry.changes || [])
      .flatMap(change => change.value?.messages || [])
      .map(message => message.type);
    logger.info(`Webhook recebido: ${(body.entry || []).length} entrada(s), mensagens: [${messageTypes.join(', ') || 'nenhuma'}]`);

    // Responder imediatamente (Meta exige 200 em < 5s)
    res.sendStatus(200);

    // Processar mensagens de forma assíncrona
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        for (const message of value.messages || []) {
          const dedup = await db.query(
            'INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT (message_id) DO NOTHING',
            [message.id]
          );
          if (dedup.rowCount === 0) {
            logger.info(`Mensagem duplicada ignorada: ${message.id}`);
            continue;
          }

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
          } else if (message.type === 'image' || message.type === 'document') {
            content = message.image?.id || message.document?.id;
          } else {
            logger.info(`Tipo de mensagem não suportado: ${message.type}`);
            continue;
          }

          await orchestrator.handle(phoneNumber, content, messageType);
        }
      }
    }

  } catch (error) {
    logger.error('Erro no webhook WhatsApp:', error);
  }
});

module.exports = router;
