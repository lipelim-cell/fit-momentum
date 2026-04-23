const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../../utils/logger');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

class WorkoutGenerator {
  
  /**
   * Gera um treino personalizado usando Claude AI
   * @param {Object} userProfile - Perfil do usuário
   * @returns {Promise<Object>} Treino gerado
   */
  async generatePersonalizedWorkout(userProfile) {
    try {
      logger.info(`Gerando treino para usuário ${userProfile.id}`);
      
      const prompt = this.buildPrompt(userProfile);
      
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const responseText = message.content[0].text;
      
      // Limpar markdown (```json) se presente
      const cleanedText = responseText
        .replace(/```json\n/g, '')
        .replace(/```\n/g, '')
        .replace(/```/g, '')
        .trim();
      
      const workoutData = JSON.parse(cleanedText);
      
      logger.info(`✅ Treino gerado com sucesso: ${workoutData.titulo}`);
      
      return workoutData;
      
    } catch (error) {
      logger.error('❌ Erro ao gerar treino:', error);
      
      // Fallback: retornar treino básico em caso de erro
      return this.getFallbackWorkout(userProfile);
    }
  }
  
  /**
   * Constrói o prompt para Claude
   */
  buildPrompt(userProfile) {
    const intensityMultiplier = userProfile.intensityLevel || 1.0;
    
    return `Você é um Personal Trainer experiente do sistema FIT MOMENTUM.

PERFIL DO ALUNO:
- ID: ${userProfile.id}
- Nome: ${userProfile.nome}
- Objetivo: ${userProfile.objetivo}
- Nível: ${userProfile.nivel}
- Local de treino: ${userProfile.local}
- Frequência: ${userProfile.diasSemana}x por semana
- Restrições/Lesões: ${userProfile.restricoes || 'Nenhuma'}
- Nível de intensidade: ${intensityMultiplier.toFixed(2)} (1.0 = padrão)

INSTRUÇÕES IMPORTANTES:
1. Crie um treino COMPLETO e ESPECÍFICO para HOJE
2. Escolha 5-7 exercícios adequados ao perfil
3. Seja ESPECÍFICO nas séries, repetições e tempos de descanso
4. Inclua aquecimento e alongamento
5. Adapte a intensidade ao nível atual (${intensityMultiplier.toFixed(2)})
6. Para "video_search_term", use termos em português que funcionem no YouTube

REGRAS DE VOLUME POR NÍVEL:
- Iniciante: 3 séries, 10-12 reps, 60-90s descanso
- Intermediário: 3-4 séries, 8-12 reps, 45-60s descanso  
- Avançado: 4-5 séries, 6-10 reps, 30-45s descanso

FORMATO DE RESPOSTA (APENAS JSON, sem markdown):
{
  "titulo": "Treino A - Peito e Tríceps",
  "tipo": "musculacao",
  "duracao_estimada": "45 minutos",
  "calorias_estimadas": 350,
  "dificuldade": "intermediario",
  "aquecimento": "5 minutos de cardio leve (polichinelos ou corda) + mobilidade articular dos ombros e cotovelos",
  "exercicios": [
    {
      "nome": "Flexão de Braços",
      "series": "3",
      "repeticoes": "12",
      "descanso_segundos": 60,
      "musculos_alvo": ["Peito", "Tríceps", "Ombros"],
      "dicas_execucao": "Mantenha o core contraído e desça até formar 90 graus com os cotovelos. Se difícil, apoie os joelhos.",
      "video_search_term": "flexao de bracos forma correta"
    },
    {
      "nome": "Supino Reto com Halteres",
      "series": "4",
      "repeticoes": "10",
      "descanso_segundos": 75,
      "musculos_alvo": ["Peito", "Tríceps", "Ombros"],
      "dicas_execucao": "Desça os halteres até a linha do peito, mantenha os cotovelos a 45 graus do corpo.",
      "video_search_term": "supino com halteres tecnica"
    }
  ],
  "alongamento": "Alongamento de peitorais (30s cada braço), tríceps (30s cada braço) e ombros (30s). Respiração profunda.",
  "observacoes": "Se sentir dor articular, pare imediatamente. Mantenha-se hidratado durante todo o treino. Foco na execução correta, não na carga.",
  "objetivo_do_treino": "Desenvolvimento de força e hipertrofia do peitoral e tríceps"
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional antes ou depois.`;
  }
  
  /**
   * Treino de fallback em caso de erro na API
   */
  getFallbackWorkout(userProfile) {
    logger.warn('Usando treino de fallback');
    
    return {
      titulo: `Treino Básico - ${userProfile.objetivo}`,
      tipo: 'geral',
      duracao_estimada: '30 minutos',
      calorias_estimadas: 250,
      dificuldade: userProfile.nivel || 'iniciante',
      aquecimento: '5 minutos de polichinelos + mobilidade articular',
      exercicios: [
        {
          nome: 'Agachamento Livre',
          series: '3',
          repeticoes: '15',
          descanso_segundos: 60,
          musculos_alvo: ['Quadríceps', 'Glúteos'],
          dicas_execucao: 'Desça até 90 graus, mantenha as costas retas',
          video_search_term: 'agachamento livre forma correta'
        },
        {
          nome: 'Flexão de Braços',
          series: '3',
          repeticoes: '10',
          descanso_segundos: 60,
          musculos_alvo: ['Peito', 'Tríceps'],
          dicas_execucao: 'Se difícil, apoie os joelhos',
          video_search_term: 'flexao de bracos'
        },
        {
          nome: 'Prancha Isométrica',
          series: '3',
          repeticoes: '30 segundos',
          descanso_segundos: 45,
          musculos_alvo: ['Core', 'Abdômen'],
          dicas_execucao: 'Mantenha o corpo alinhado',
          video_search_term: 'prancha abdominal'
        }
      ],
      alongamento: 'Alongamento geral de 5 minutos',
      observacoes: 'Treino básico gerado automaticamente. Para treinos personalizados, verifique sua conexão.',
      objetivo_do_treino: 'Condicionamento físico geral'
    };
  }
  
  /**
   * Adapta o treino baseado no feedback do usuário
   */
  async adaptIntensity(userId, feedback) {
    try {
      logger.info(`Adaptando intensidade para usuário ${userId}: ${feedback}`);
      
      const db = require('../../config/database');
      
      // Buscar nível atual
      const result = await db.query(
        'SELECT intensity_level FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Usuário não encontrado');
      }
      
      let currentLevel = parseFloat(result.rows[0].intensity_level) || 1.0;
      let newLevel = currentLevel;
      
      // Ajustar baseado no feedback
      switch(feedback) {
        case 'muito_facil':
          newLevel = Math.min(currentLevel + 0.15, 2.0); // Max 2.0
          break;
        case 'facil':
          newLevel = Math.min(currentLevel + 0.08, 2.0);
          break;
        case 'dificil':
          newLevel = Math.max(currentLevel - 0.08, 0.5); // Min 0.5
          break;
        case 'muito_dificil':
          newLevel = Math.max(currentLevel - 0.15, 0.5);
          break;
        case 'ideal':
        default:
          newLevel = currentLevel; // Mantém
      }
      
      // Atualizar no banco
      await db.query(
        'UPDATE users SET intensity_level = $1, updated_at = NOW() WHERE id = $2',
        [newLevel, userId]
      );
      
      logger.info(`Intensidade atualizada: ${currentLevel.toFixed(2)} → ${newLevel.toFixed(2)}`);
      
      return newLevel;
      
    } catch (error) {
      logger.error('Erro ao adaptar intensidade:', error);
      throw error;
    }
  }
}

module.exports = new WorkoutGenerator();
