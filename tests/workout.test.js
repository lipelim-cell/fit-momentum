jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args),
}));

const mockSendText = jest.fn().mockResolvedValue();
const mockSendWorkout = jest.fn().mockResolvedValue();
jest.mock('../src/services/whatsapp/messageSender', () => ({
  sendText: (...args) => mockSendText(...args),
  sendWorkout: (...args) => mockSendWorkout(...args),
}));

const mockGenerate = jest.fn();
jest.mock('../src/services/ai/workoutGenerator', () => ({
  generatePersonalizedWorkout: (...args) => mockGenerate(...args),
}));

const workoutAgent = require('../src/agents/workout');

describe('WorkoutAgent.sendTodaysWorkout', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockSendWorkout.mockClear();
    mockGenerate.mockReset();
  });

  it('reenvia o treino existente sem chamar o gerador de IA nem inserir de novo', async () => {
    const treinoSalvo = { titulo: 'Treino A', exercicios: [{ nome: 'Agachamento' }] };
    mockQuery.mockResolvedValueOnce({ rows: [{ exercicios: treinoSalvo }] });

    await workoutAgent.sendTodaysWorkout(user);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Reenviando'));
    expect(mockSendWorkout).toHaveBeenCalledWith(user.phone, treinoSalvo);
  });

  it('gera e salva um treino novo quando não existe treino do dia', async () => {
    const workoutGerado = { titulo: 'Treino B', duracao_estimada: '45 minutos', calorias_estimadas: 300 };
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT não encontra treino
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    mockGenerate.mockResolvedValueOnce(workoutGerado);

    await workoutAgent.sendTodaysWorkout(user);

    expect(mockGenerate).toHaveBeenCalledWith(user);
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Gerando'));
    expect(mockSendWorkout).toHaveBeenCalledWith(user.phone, workoutGerado);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toContain('INSERT INTO workouts');
  });
});
