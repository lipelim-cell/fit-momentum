jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args),
}));

const mockSendText = jest.fn().mockResolvedValue();
jest.mock('../src/services/whatsapp/messageSender', () => ({
  sendText: (...args) => mockSendText(...args),
}));

jest.mock('../src/agents/workout', () => ({
  sendTodaysWorkout: jest.fn().mockResolvedValue(),
  handleFeedback: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/agents/progress', () => ({
  sendReport: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/agents/subscription', () => ({
  presentPlans: jest.fn().mockResolvedValue(),
  handleReactivation: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/agents/onboarding', () => ({
  handle: jest.fn().mockResolvedValue(),
}));

const orchestrator = require('../src/agents/orchestrator');

describe('OrchestratorAgent._handleActive — fallback menos robótico (item 5)', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana', conversation_state: 'active' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockQuery.mockResolvedValueOnce({ rows: [user] }); // _findOrCreateUser
    mockQuery.mockResolvedValueOnce({ rows: [] });      // _touchUser
  });

  it('"oi" recebe saudação com o nome, não o menu seco', async () => {
    await orchestrator.handle(user.phone, 'oi');

    expect(mockSendText).toHaveBeenCalledWith(
      user.phone,
      expect.stringContaining(`Oi, *${user.nome}*`)
    );
    expect(mockSendText).not.toHaveBeenCalledWith(
      user.phone,
      expect.stringContaining('todos os comandos')
    );
  });

  it('"bom dia" também é reconhecido como saudação', async () => {
    await orchestrator.handle(user.phone, 'Bom dia');

    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Oi,'));
  });

  it('"valeu" responde com agradecimento', async () => {
    await orchestrator.handle(user.phone, 'valeu!');

    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Tamo junto'));
  });

  it('mensagem com "?" orienta a digitar AJUDA', async () => {
    await orchestrator.handle(user.phone, 'como funciona isso?');

    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('AJUDA'));
  });

  it('mensagem não reconhecida cai no menu padrão', async () => {
    await orchestrator.handle(user.phone, 'blablabla');

    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('todos os comandos'));
  });
});
