const maskPhone = require('../src/utils/maskPhone');

describe('maskPhone', () => {
  it('mascara um telefone completo mantendo os 4 primeiros e 4 últimos dígitos', () => {
    expect(maskPhone('5511999990001')).toBe('5511*****0001');
  });

  it('mascara totalmente números curtos (8 dígitos ou menos)', () => {
    expect(maskPhone('12345678')).toBe('********');
  });

  it('retorna o valor original quando vazio/nulo', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeUndefined();
    expect(maskPhone('')).toBe('');
  });
});
