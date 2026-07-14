jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

const workoutGenerator = require('../src/services/ai/workoutGenerator');

describe('WorkoutGenerator.buildPrompt', () => {
  // Objeto no formato exato retornado pelo Postgres: colunas snake_case,
  // intensity_level como string (coluna DECIMAL).
  const dbUserProfile = {
    id: 1,
    nome: 'Ana Silva',
    objetivo: 'perder peso',
    nivel: 'iniciante',
    local_treino: 'casa sem equipamentos',
    dias_semana: 3,
    restricoes: null,
    intensity_level: '0.92',
  };

  it('nunca contém a substring "undefined"', () => {
    const prompt = workoutGenerator.buildPrompt(dbUserProfile);
    expect(prompt).not.toMatch(/undefined/);
  });

  it('usa local_treino e dias_semana corretamente', () => {
    const prompt = workoutGenerator.buildPrompt(dbUserProfile);
    expect(prompt).toContain('Local de treino: casa sem equipamentos');
    expect(prompt).toContain('Frequência: 3x por semana');
  });

  it('converte intensity_level (string) com parseFloat sem lançar exceção', () => {
    const prompt = workoutGenerator.buildPrompt(dbUserProfile);
    expect(prompt).toContain('Nível de intensidade: 0.92');
  });

  it('aplica valores padrão quando local_treino e dias_semana vêm nulos', () => {
    const incompleteProfile = {
      id: 2,
      nome: 'Carlos',
      objetivo: 'ganhar massa',
      nivel: 'intermediario',
      local_treino: null,
      dias_semana: null,
      intensity_level: null,
    };

    const prompt = workoutGenerator.buildPrompt(incompleteProfile);
    expect(prompt).not.toMatch(/undefined/);
    expect(prompt).toContain('Local de treino: academia');
    expect(prompt).toContain('Frequência: 3x por semana');
    expect(prompt).toContain('Nível de intensidade: 1.00');
  });
});
