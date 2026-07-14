jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockAnthropicGenerate = jest.fn();
jest.mock('../src/services/ai/providers/anthropicProvider', () => ({
  generate: (...args) => mockAnthropicGenerate(...args),
}));

const mockDeepseekGenerate = jest.fn();
jest.mock('../src/services/ai/providers/deepseekProvider', () => ({
  generate: (...args) => mockDeepseekGenerate(...args),
}));

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

describe('WorkoutGenerator.generatePersonalizedWorkout', () => {
  const userProfile = {
    id: 1,
    nome: 'Ana Silva',
    objetivo: 'perder peso',
    nivel: 'iniciante',
    local_treino: 'casa sem equipamentos',
    dias_semana: 3,
    intensity_level: '1.00',
  };

  const validWorkoutJson = JSON.stringify({
    titulo: 'Treino A',
    exercicios: [
      { nome: 'Agachamento', series: '3', repeticoes: '12' },
      { nome: 'Flexão', series: '3', repeticoes: '10' },
      { nome: 'Prancha', series: '3', repeticoes: '30s' },
    ],
  });

  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    mockAnthropicGenerate.mockReset();
    mockDeepseekGenerate.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('usa o provider Anthropic por padrão (sem AI_PROVIDER definido)', async () => {
    delete process.env.AI_PROVIDER;
    mockAnthropicGenerate.mockResolvedValueOnce(validWorkoutJson);

    const workout = await workoutGenerator.generatePersonalizedWorkout(userProfile);

    expect(mockAnthropicGenerate).toHaveBeenCalledTimes(1);
    expect(mockDeepseekGenerate).not.toHaveBeenCalled();
    expect(workout.titulo).toBe('Treino A');
  });

  it('usa o provider DeepSeek quando AI_PROVIDER=deepseek e a chave está configurada', async () => {
    process.env.AI_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'chave-deepseek';
    mockDeepseekGenerate.mockResolvedValueOnce(validWorkoutJson);

    const workout = await workoutGenerator.generatePersonalizedWorkout(userProfile);

    expect(mockDeepseekGenerate).toHaveBeenCalledTimes(1);
    expect(mockAnthropicGenerate).not.toHaveBeenCalled();
    expect(workout.titulo).toBe('Treino A');
  });

  it('cai no fallback quando AI_PROVIDER=deepseek sem DEEPSEEK_API_KEY configurada', async () => {
    process.env.AI_PROVIDER = 'deepseek';
    delete process.env.DEEPSEEK_API_KEY;

    const workout = await workoutGenerator.generatePersonalizedWorkout(userProfile);

    expect(mockDeepseekGenerate).not.toHaveBeenCalled();
    expect(workout.titulo).toContain('Treino Básico');
  });

  it('cai no fallback quando o JSON retornado é inválido (menos de 3 exercícios)', async () => {
    delete process.env.AI_PROVIDER;
    mockAnthropicGenerate.mockResolvedValueOnce(JSON.stringify({
      titulo: 'Treino Incompleto',
      exercicios: [{ nome: 'Agachamento', series: '3', repeticoes: '12' }],
    }));

    const workout = await workoutGenerator.generatePersonalizedWorkout(userProfile);

    expect(workout.titulo).toContain('Treino Básico');
  });

  it('cai no fallback sem quebrar quando o texto retornado não é JSON válido', async () => {
    delete process.env.AI_PROVIDER;
    mockAnthropicGenerate.mockResolvedValueOnce('isso não é json');

    const workout = await workoutGenerator.generatePersonalizedWorkout(userProfile);

    expect(workout.titulo).toContain('Treino Básico');
  });
});
