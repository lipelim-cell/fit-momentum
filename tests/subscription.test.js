jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args),
}));

const mockSendText = jest.fn().mockResolvedValue();
const mockSendInteractiveButtons = jest.fn().mockResolvedValue();
jest.mock('../src/services/whatsapp/messageSender', () => ({
  sendText: (...args) => mockSendText(...args),
  sendInteractiveButtons: (...args) => mockSendInteractiveButtons(...args),
}));

const subscriptionAgent = require('../src/agents/subscription');

describe('SubscriptionAgent.processPlanChoice', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana' };

  beforeEach(() => {
    mockQuery.mockClear();
    mockSendText.mockClear();
    mockSendInteractiveButtons.mockClear();
  });

  it('reapresenta os botões e não grava nada no banco para entrada inválida', async () => {
    await subscriptionAgent.processPlanChoice(user, 'oi');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendInteractiveButtons).toHaveBeenCalled();
    const [, bodyText] = mockSendText.mock.calls[0];
    expect(bodyText).toMatch(/Não entendi/);
  });

  it('grava plano básico como pending_payment (não altera para "active")', async () => {
    await subscriptionAgent.processPlanChoice(user, 'plan_basico');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('conversation_state'),
      ['basico', 'pending', 'pending_payment', user.id]
    );
  });

  it('teste grátis continua ativando o usuário imediatamente', async () => {
    await subscriptionAgent.processPlanChoice(user, 'plan_teste');

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain("status_pagamento = 'teste'");
    expect(sql).toContain("conversation_state = 'active'");
  });
});

describe('SubscriptionAgent.handlePendingPayment', () => {
  const user = { id: 1, phone: '5511999990001', nome: 'Ana', plano: 'basico' };

  beforeEach(() => {
    mockQuery.mockClear();
    mockSendText.mockClear();
    delete process.env.ADMIN_PHONE;
  });

  it('mensagem de texto lembra da chave PIX sem gravar nada', async () => {
    await subscriptionAgent.handlePendingPayment(user, 'oi', 'text');

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('PIX'));
  });

  it('imagem registra comprovante em payments e confirma recebimento', async () => {
    await subscriptionAgent.handlePendingPayment(user, 'media-id-123', 'image');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payments'),
      [user.id, user.plano, 49, 'media-id-123']
    );
    expect(mockSendText).toHaveBeenCalledWith(user.phone, expect.stringContaining('Comprovante recebido'));
  });

  it('sem ADMIN_PHONE configurado, não tenta notificar admin', async () => {
    await subscriptionAgent.handlePendingPayment(user, 'media-id-123', 'document');
    expect(mockSendText).toHaveBeenCalledTimes(1);
  });
});
