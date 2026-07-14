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

  it('envia o treino em 3 mensagens sequenciais, sem botões de feedback', async () => {
    await messageSender.sendWorkout('5511999990001', workout);

    expect(axios.post).toHaveBeenCalledTimes(3);

    const bodies = axios.post.mock.calls.map(([, payload]) => {
      expect(payload.type).toBe('text');
      return payload.text.body;
    });

    expect(bodies[0]).toContain(workout.titulo);
    expect(bodies[0]).toContain('AQUECIMENTO');
    expect(bodies[1]).toContain('EXERCÍCIOS');
    expect(bodies[1]).toContain('Agachamento');
    expect(bodies[2]).toContain('ALONGAMENTO');
    expect(bodies[2]).toContain('Quando terminar, é só me contar como foi');
    expect(bodies.join('\n')).not.toContain('Como foi o treino de hoje?');
  });
});

describe('MessageSender.sendInteractiveList', () => {
  beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockResolvedValue({ data: {} });
  });

  it('envia todas as linhas (até 10) como list message, sem cortar em 3', async () => {
    const rows = [
      { id: 'obj_perder', title: '🔵 Perder peso' },
      { id: 'obj_ganhar', title: '💪 Ganhar massa' },
      { id: 'obj_definir', title: '⚡ Definição' },
      { id: 'obj_saude', title: '❤️ Saúde geral' },
    ];

    await messageSender.sendInteractiveList('5511999990001', 'Qual seu objetivo?', 'Escolher', rows);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, payload] = axios.post.mock.calls[0];
    expect(payload.interactive.type).toBe('list');
    expect(payload.interactive.action.sections[0].rows).toHaveLength(4);
    expect(payload.interactive.action.sections[0].rows.map(r => r.id)).toEqual(
      rows.map(r => r.id)
    );
  });
});
