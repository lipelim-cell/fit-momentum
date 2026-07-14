const crypto = require('crypto');

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args),
}));

const mockHandle = jest.fn().mockResolvedValue();
jest.mock('../src/agents/orchestrator', () => ({
  handle: (...args) => mockHandle(...args),
}));

function getPostHandler(router) {
  const layer = router.stack.find(
    l => l.route && l.route.path === '/whatsapp' && l.route.methods.post
  );
  return layer.route.stack[0].handle;
}

function mockRes() {
  const res = {};
  res.sendStatus = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildBody(messages) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { messages } }] }],
  };
}

function textMessage(id, from, text) {
  return { id, from, type: 'text', text: { body: text } };
}

function sign(secret, rawBody) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

describe('webhook.js POST /whatsapp', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    mockQuery.mockReset();
    mockHandle.mockClear();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responde 401 quando a assinatura está ausente (META_APP_SECRET configurado)', async () => {
    process.env.META_APP_SECRET = 'app-secret';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    const body = buildBody([textMessage('wamid.1', '5511999990001', 'oi')]);
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = { headers: {}, body, rawBody, ip: '1.2.3.4' };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mockHandle).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('responde 401 quando a assinatura foi calculada com o secret errado', async () => {
    process.env.META_APP_SECRET = 'app-secret-correto';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    const body = buildBody([textMessage('wamid.1', '5511999990001', 'oi')]);
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = {
      headers: { 'x-hub-signature-256': sign('secret-errado', rawBody) },
      body, rawBody, ip: '1.2.3.4',
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('processa normalmente quando a assinatura é válida', async () => {
    process.env.META_APP_SECRET = 'app-secret-correto';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT processed_messages (nova)

    const body = buildBody([textMessage('wamid.1', '5511999990001', 'oi')]);
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = {
      headers: { 'x-hub-signature-256': sign('app-secret-correto', rawBody) },
      body, rawBody, ip: '1.2.3.4',
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(mockHandle).toHaveBeenCalledWith('5511999990001', 'oi', 'text');
  });

  it('ignora mensagem duplicada (mesmo message.id já processado) e não chama o orchestrator', async () => {
    process.env.META_APP_SECRET = 'app-secret-correto';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // ON CONFLICT DO NOTHING -> já existia

    const body = buildBody([textMessage('wamid.duplicada', '5511999990001', 'oi')]);
    const rawBody = Buffer.from(JSON.stringify(body));
    const req = {
      headers: { 'x-hub-signature-256': sign('app-secret-correto', rawBody) },
      body, rawBody, ip: '1.2.3.4',
    };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(mockHandle).not.toHaveBeenCalled();
  });

  it('em desenvolvimento sem META_APP_SECRET, continua funcional', async () => {
    delete process.env.META_APP_SECRET;
    process.env.NODE_ENV = 'development';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const body = buildBody([textMessage('wamid.1', '5511999990001', 'oi')]);
    const req = { headers: {}, body, rawBody: Buffer.from(JSON.stringify(body)), ip: '1.2.3.4' };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(mockHandle).toHaveBeenCalledWith('5511999990001', 'oi', 'text');
  });

  it('em produção sem META_APP_SECRET, responde 503 e não processa nada', async () => {
    delete process.env.META_APP_SECRET;
    process.env.NODE_ENV = 'production';
    const router = require('../src/routes/webhook');
    const handler = getPostHandler(router);

    const body = buildBody([textMessage('wamid.1', '5511999990001', 'oi')]);
    const req = { headers: {}, body, rawBody: Buffer.from(JSON.stringify(body)), ip: '1.2.3.4' };
    const res = mockRes();

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(503);
    expect(mockHandle).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
