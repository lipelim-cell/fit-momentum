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
jest.mock('../src/services/whatsapp/messageSender', () => ({
  sendText: (...args) => mockSendText(...args),
  sendWorkout: jest.fn().mockResolvedValue(),
}));

const mockAdaptIntensity = jest.fn().mockResolvedValue();
jest.mock('../src/services/ai/workoutGenerator', () => ({
  adaptIntensity: (...args) => mockAdaptIntensity(...args),
}));

const workoutAgent = require('../src/agents/workout');

describe('WorkoutAgent.handleFeedback', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana', current_streak: 4 };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockAdaptIntensity.mockClear();
  });

  it('marca o treino de hoje como completado e grava o feedback', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ was_completed: false }] }) // UPDATE workouts
      .mockResolvedValueOnce({ rows: [{ foi_ontem: false }] })     // SELECT streak
      .mockResolvedValueOnce({ rows: [] });                        // UPDATE users streak

    await workoutAgent.handleFeedback(user, 'feedback_ideal');

    expect(mockAdaptIntensity).toHaveBeenCalledWith(user.id, 'ideal');
    expect(mockQuery.mock.calls[0][0]).toContain('UPDATE workouts');
    expect(mockQuery.mock.calls[0][1]).toEqual(['ideal', user.id]);
  });

  it('incrementa o streak quando o dia anterior também teve treino completado', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ was_completed: false }] })
      .mockResolvedValueOnce({ rows: [{ foi_ontem: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await workoutAgent.handleFeedback(user, 'feedback_ideal');

    expect(mockQuery.mock.calls[2][0]).toContain('UPDATE users SET current_streak');
    expect(mockQuery.mock.calls[2][1]).toEqual([5, user.id]); // 4 + 1
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('5 dias'));
  });

  it('reinicia o streak em 1 quando não treinou ontem', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ was_completed: false }] })
      .mockResolvedValueOnce({ rows: [{ foi_ontem: false }] })
      .mockResolvedValueOnce({ rows: [] });

    await workoutAgent.handleFeedback(user, 'feedback_ideal');

    expect(mockQuery.mock.calls[2][1]).toEqual([1, user.id]);
  });

  it('não incrementa o streak duas vezes se o treino de hoje já estava completado', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ was_completed: true }] }); // UPDATE workouts

    await workoutAgent.handleFeedback(user, 'feedback_facil');

    expect(mockQuery).toHaveBeenCalledTimes(1); // só o UPDATE de workouts, sem tocar em streak
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.not.stringContaining('dias'));
  });

  it('não quebra e não mexe em streak quando não há treino salvo para hoje', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE workouts não encontrou linha

    await workoutAgent.handleFeedback(user, 'feedback_dificil');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendText).toHaveBeenCalled();
  });

  it('ignora feedback_id desconhecido sem consultar o banco', async () => {
    await workoutAgent.handleFeedback(user, 'feedback_bomba');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockAdaptIntensity).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('feedback_nao_fiz grava o feedback sem marcar conclusão e sem mexer na intensidade', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE workouts (só feedback)

    await workoutAgent.handleFeedback(user, 'feedback_nao_fiz');

    expect(mockAdaptIntensity).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE workouts');
    expect(sql).not.toContain('completado = true');
    expect(params).toEqual(['nao_fiz', user.id]);
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Tudo bem'));
  });
});
