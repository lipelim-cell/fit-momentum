jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const apiAuth = require('../src/middleware/apiAuth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('apiAuth middleware', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('responde 503 quando ADMIN_API_KEY não está configurada', () => {
    delete process.env.ADMIN_API_KEY;
    const req = { get: () => undefined, ip: '127.0.0.1' };
    const res = mockRes();
    const next = jest.fn();

    apiAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 quando a chave está ausente', () => {
    process.env.ADMIN_API_KEY = 'chave-correta';
    const req = { get: () => undefined, ip: '127.0.0.1' };
    const res = mockRes();
    const next = jest.fn();

    apiAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 quando a chave está incorreta', () => {
    process.env.ADMIN_API_KEY = 'chave-correta';
    const req = { get: () => 'chave-errada', ip: '127.0.0.1' };
    const res = mockRes();
    const next = jest.fn();

    apiAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next() quando a chave está correta', () => {
    process.env.ADMIN_API_KEY = 'chave-correta';
    const req = { get: () => 'chave-correta', ip: '127.0.0.1' };
    const res = mockRes();
    const next = jest.fn();

    apiAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
