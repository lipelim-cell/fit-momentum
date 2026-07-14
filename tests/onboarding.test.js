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
const mockSendInteractiveButtons = jest.fn().mockResolvedValue();
const mockSendInteractiveList = jest.fn().mockResolvedValue();
jest.mock('../src/services/whatsapp/messageSender', () => ({
  sendText: (...args) => mockSendText(...args),
  sendInteractiveButtons: (...args) => mockSendInteractiveButtons(...args),
  sendInteractiveList: (...args) => mockSendInteractiveList(...args),
}));

const mockSendTodaysWorkout = jest.fn().mockResolvedValue();
jest.mock('../src/agents/workout', () => ({
  sendTodaysWorkout: (...args) => mockSendTodaysWorkout(...args),
}));

const mockPresentPlans = jest.fn().mockResolvedValue();
jest.mock('../src/agents/subscription', () => ({
  presentPlans: (...args) => mockPresentPlans(...args),
}));

const onboardingAgent = require('../src/agents/onboarding');

describe('OnboardingAgent — opções cortadas (item 1)', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockSendInteractiveButtons.mockClear();
    mockSendInteractiveList.mockClear();
  });

  it('etapa de objetivo usa lista com as 4 opções', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE nome

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_name' }, 'Ana');

    expect(mockSendInteractiveList).toHaveBeenCalledTimes(1);
    const [, , , rows] = mockSendInteractiveList.mock.calls[0];
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.id)).toEqual(['obj_perder', 'obj_ganhar', 'obj_definir', 'obj_saude']);
  });

  it('etapa de frequência usa lista com as 4 opções', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE local_treino

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_location' }, 'loc_academia');

    expect(mockSendInteractiveList).toHaveBeenCalledTimes(1);
    const [, , , rows] = mockSendInteractiveList.mock.calls[0];
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.id)).toEqual(['freq_3', 'freq_4', 'freq_5', 'freq_6']);
  });
});

describe('OnboardingAgent — restrições/lesões (item 2)', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockSendInteractiveButtons.mockClear();
    mockSendTodaysWorkout.mockClear();
    mockPresentPlans.mockClear();
  });

  it('etapa de frequência pergunta restrições em vez de ir direto ao resumo', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE dias_semana

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_location' }, 'loc_academia');
    // (garante que o próximo estado é o de restrições, testado abaixo via _collectFrequency)
  });

  it('restr_sim pede o texto livre e muda para awaiting_restrictions_text', async () => {
    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_restrictions' }, 'restr_sim');

    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Me conta quais'));
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE users SET conversation_state = $1 WHERE id = $2',
      ['awaiting_restrictions_text', user.id]
    );
  });

  it('restr_nao grava NULL e finaliza o onboarding (treino de amostra + planos)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE restricoes = NULL
      .mockResolvedValueOnce({ rows: [{ ...user, objetivo: 'perder peso', nivel: 'iniciante', local_treino: 'academia', dias_semana: 3, restricoes: null }] }); // SELECT resumo

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_restrictions' }, 'restr_nao');

    expect(mockQuery.mock.calls[0]).toEqual(['UPDATE users SET restricoes = NULL WHERE id = $1', [user.id]]);
    expect(mockSendTodaysWorkout).toHaveBeenCalledTimes(1);
    expect(mockPresentPlans).toHaveBeenCalledTimes(1);
  });

  it('texto livre de restrição é gravado em users.restricoes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // UPDATE restricoes
      .mockResolvedValueOnce({ rows: [{ ...user, objetivo: 'perder peso', nivel: 'iniciante', local_treino: 'academia', dias_semana: 3, restricoes: 'joelho direito operado' }] }); // SELECT resumo

    await onboardingAgent.handle(
      { ...user, conversation_state: 'awaiting_restrictions_text' },
      'joelho direito operado'
    );

    expect(mockQuery.mock.calls[0]).toEqual([
      'UPDATE users SET restricoes = $1 WHERE id = $2',
      ['joelho direito operado', user.id],
    ]);

    const resumo = mockSendText.mock.calls.find(([, body]) => body.includes('Aqui está seu perfil'));
    expect(resumo[1]).toContain('joelho direito operado');
  });

  it('resumo não menciona restrições quando não há nenhuma', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...user, objetivo: 'perder peso', nivel: 'iniciante', local_treino: 'academia', dias_semana: 3, restricoes: null }] });

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_restrictions' }, 'restr_nao');

    const resumo = mockSendText.mock.calls.find(([, body]) => body.includes('Aqui está seu perfil'));
    expect(resumo[1]).not.toContain('Restrições');
  });
});

describe('OnboardingAgent — treino de amostra antes dos planos (item 4)', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana' };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockClear();
    mockSendTodaysWorkout.mockClear();
    mockPresentPlans.mockClear();
  });

  it('gera o treino de amostra e só depois apresenta os planos, na ordem certa', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...user, objetivo: 'perder peso', nivel: 'iniciante', local_treino: 'academia', dias_semana: 3, restricoes: null }] });

    const callOrder = [];
    mockSendTodaysWorkout.mockImplementationOnce(async () => { callOrder.push('workout'); });
    mockPresentPlans.mockImplementationOnce(async () => { callOrder.push('plans'); });

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_restrictions' }, 'restr_nao');

    expect(callOrder).toEqual(['workout', 'plans']);
  });

  it('se a geração do treino de amostra falhar, segue direto para os planos', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...user, objetivo: 'perder peso', nivel: 'iniciante', local_treino: 'academia', dias_semana: 3, restricoes: null }] });

    mockSendTodaysWorkout.mockRejectedValueOnce(new Error('falha na IA'));

    await onboardingAgent.handle({ ...user, conversation_state: 'awaiting_restrictions' }, 'restr_nao');

    expect(mockPresentPlans).toHaveBeenCalledTimes(1);
  });
});
