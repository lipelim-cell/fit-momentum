process.env.MESSAGE_DELAY_MS = '0';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-number-id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('axios');
const axios = require('axios');

const messageSender = require('../src/services/whatsapp/messageSender');

describe('MessageSender.sendWorkout', () => {
  const workout = {
    titulo: 'Treino A',
    duracao_estimada: '45 minutos',
    calorias_estimadas: 350,
    dificuldade: 'iniciante',
    aquecimento: 'Aquecimento leve',
    exercicios: [
      { nome: 'Agachamento', series: '3', repeticoes: '12', descanso_segundos: 60, dicas_execucao: 'Desça devagar' },
    ],
    alongamento: 'Alongamento geral',
    observacoes: 'Beba água',
  };

  beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockResolvedValue({ data: {} });
  });

  it('envia apenas a mensagem de texto do treino, sem botões de feedback', async () => {
    await messageSender.sendWorkout('5511999990001', workout);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, payload] = axios.post.mock.calls[0];
    expect(payload.type).toBe('text');
    expect(payload.text.body).toContain('Quando terminar, é só me contar como foi');
    expect(payload.text.body).not.toContain('Como foi o treino de hoje?');
  });
});
