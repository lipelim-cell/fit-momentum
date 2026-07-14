const axios = require('axios');
const logger = require('../../utils/logger');
const maskPhone = require('../../utils/maskPhone');

const parsedDelay = parseInt(process.env.MESSAGE_DELAY_MS, 10);
const DELAY_MS = Number.isNaN(parsedDelay) ? 2000 : parsedDelay;

class MessageSender {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async _send(payload) {
    if (!this.phoneNumberId || !this.accessToken) {
      logger.warn(`WhatsApp não configurado — mensagem ignorada (tipo=${payload.type}, para=${maskPhone(payload.to)})`);
      logger.debug('Payload completo da mensagem ignorada:', JSON.stringify(payload));
      return;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
      );
      logger.info(`✅ Mensagem enviada para ${maskPhone(payload.to)}`);
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      logger.error(`❌ Erro ao enviar mensagem para ${maskPhone(payload.to)}: ${msg}`);
      throw error;
    }
  }

  async sendText(to, text) {
    await this._send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    });
    await this._delay();
  }

  async sendInteractiveButtons(to, bodyText, buttons) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title.slice(0, 20) },
          })),
        },
      },
    };
    await this._send(payload);
    await this._delay();
  }

  async sendInteractiveList(to, bodyText, buttonLabel, rows) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonLabel.slice(0, 20),
          sections: [
            {
              rows: rows.slice(0, 10).map(row => ({
                id: row.id,
                title: row.title.slice(0, 24),
                ...(row.description ? { description: row.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    };
    await this._send(payload);
    await this._delay();
  }

  async sendWorkout(to, workout) {
    const cabecalho =
      `🏋️ *${workout.titulo}*\n\n` +
      `⏱️ Duração: ${workout.duracao_estimada}\n` +
      `🔥 Calorias: ~${workout.calorias_estimadas} kcal\n` +
      `📈 Dificuldade: ${workout.dificuldade}\n\n` +
      `*🔥 AQUECIMENTO:*\n${workout.aquecimento}`;

    const exerciciosTexto = workout.exercicios
      .map((ex, i) =>
        `*${i + 1}. ${ex.nome}*\n` +
        `   📊 ${ex.series} séries × ${ex.repeticoes} reps\n` +
        `   ⏱️ Descanso: ${ex.descanso_segundos}s\n` +
        `   💡 ${ex.dicas_execucao}`
      )
      .join('\n\n');

    const fechamento =
      `*🧘 ALONGAMENTO:*\n${workout.alongamento}\n\n` +
      `*📝 OBSERVAÇÕES:*\n${workout.observacoes}\n\n` +
      `Quando terminar, é só me contar como foi! 💪 (vou te perguntar à noite também)`;

    await this.sendText(to, cabecalho);
    await this.sendText(to, `*💪 EXERCÍCIOS:*\n\n${exerciciosTexto}`);
    await this.sendText(to, fechamento);
  }

  _delay() {
    return new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }
}

module.exports = new MessageSender();
