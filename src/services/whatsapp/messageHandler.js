const messageSender = require('./messageSender');
const workoutGenerator = require('../ai/workoutGenerator');
const logger = require('../../utils/logger');
const db = require('../../config/database');

class MessageHandler {
  
  /**
   * Processa mensagem recebida do WhatsApp
   */
  async handleIncomingMessage(phoneNumber, message, messageType = 'text') {
    try {
      logger.info(`📨 Mensagem recebida de ${phoneNumber}: ${message}`);
      
      // Buscar ou criar usuário
      let user = await this.findOrCreateUser(phoneNumber);
      
      // Processar baseado no estado da conversa
      await this.processMessageByState(user, message, messageType);
      
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
      await messageSender.sendText(phoneNumber,
        '❌ Desculpe, ocorreu um erro. Tente novamente em alguns instantes.\n\nSe o problema persistir, digite *AJUDA*.'
      );
    }
  }
  
  /**
   * Busca usuário ou cria novo
   */
  async findOrCreateUser(phoneNumber) {
    const result = await db.query(
      'SELECT * FROM users WHERE phone = $1',
      [phoneNumber]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Criar novo usuário
    const newUser = await db.query(
      `INSERT INTO users (phone, conversation_state, created_at) 
       VALUES ($1, 'new', NOW()) 
       RETURNING *`,
      [phoneNumber]
    );
    
    logger.info(`👤 Novo usuário criado: ${phoneNumber}`);
    
    return newUser.rows[0];
  }
  
  /**
   * Processa mensagem baseado no estado
   */
  async processMessageByState(user, message, messageType) {
    const state = user.conversation_state;
    const messageLower = message.toLowerCase().trim();
    
    // Comandos globais (funcionam em qualquer estado)
    if (messageLower === 'ajuda' || messageLower === 'help') {
      return await this.sendHelpMessage(user.phone);
    }
    
    if (messageLower === 'treino' && user.plano !== 'none') {
      return await this.sendTodaysWorkout(user);
    }
    
    // Estados específicos
    switch(state) {
      case 'new':
        await this.startOnboarding(user);
        break;
        
      case 'awaiting_name':
        await this.collectName(user, message);
        break;
        
      case 'awaiting_objective':
        await this.collectObjective(user, message);
        break;
        
      case 'awaiting_level':
        await this.collectLevel(user, message);
        break;
        
      case 'awaiting_location':
        await this.collectLocation(user, message);
        break;
        
      case 'awaiting_frequency':
        await this.collectFrequency(user, message);
        break;
        
      case 'awaiting_plan_choice':
        await this.collectPlanChoice(user, message);
        break;
        
      case 'active':
        await this.handleActiveUser(user, message);
        break;
        
      default:
        await this.handleUnknownState(user);
    }
    
    // Atualizar última interação
    await db.query(
      'UPDATE users SET last_interaction = NOW() WHERE id = $1',
      [user.id]
    );
  }
  
  /**
   * Inicia onboarding de novo usuário
   */
  async startOnboarding(user) {
    await messageSender.sendText(user.phone,
      `👋 *Olá! Bem-vindo ao FIT MOMENTUM!*\n\n` +
      `Eu sou seu Personal Trainer com Inteligência Artificial! 🤖💪\n\n` +
      `Vou criar treinos 100% personalizados para você, com vídeos de cada exercício.\n\n` +
      `Primeiro, qual é o seu *nome*?`
    );
    
    await this.updateUserState(user.id, 'awaiting_name');
  }
  
  /**
   * Coleta nome
   */
  async collectName(user, name) {
    await db.query(
      'UPDATE users SET nome = $1 WHERE id = $2',
      [name, user.id]
    );
    
    await messageSender.sendInteractiveButtons(user.phone,
      `Prazer, *${name}*! 😊\n\nQual seu principal *objetivo*?`,
      [
        { id: 'obj_perder', title: '🔵 Perder peso' },
        { id: 'obj_ganhar', title: '💪 Ganhar massa' },
        { id: 'obj_definir', title: '⚡ Definição' },
        { id: 'obj_saude', title: '❤️ Saúde geral' }
      ]
    );
    
    await this.updateUserState(user.id, 'awaiting_objective');
  }
  
  /**
   * Coleta objetivo
   */
  async collectObjective(user, buttonId) {
    const objectives = {
      'obj_perder': 'perder peso',
      'obj_ganhar': 'ganhar massa',
      'obj_definir': 'definição',
      'obj_saude': 'saúde geral'
    };
    
    const objetivo = objectives[buttonId] || buttonId;
    
    await db.query(
      'UPDATE users SET objetivo = $1 WHERE id = $2',
      [objetivo, user.id]
    );
    
    await messageSender.sendInteractiveButtons(user.phone,
      'Qual seu *nível* de experiência com treinos?',
      [
        { id: 'nv_iniciante', title: '🌱 Iniciante' },
        { id: 'nv_intermediario', title: '📈 Intermediário' },
        { id: 'nv_avancado', title: '🏆 Avançado' }
      ]
    );
    
    await this.updateUserState(user.id, 'awaiting_level');
  }
  
  /**
   * Coleta nível
   */
  async collectLevel(user, buttonId) {
    const levels = {
      'nv_iniciante': 'iniciante',
      'nv_intermediario': 'intermediario',
      'nv_avancado': 'avancado'
    };
    
    const nivel = levels[buttonId] || buttonId;
    
    await db.query(
      'UPDATE users SET nivel = $1 WHERE id = $2',
      [nivel, user.id]
    );
    
    await messageSender.sendInteractiveButtons(user.phone,
      'Onde você vai *treinar*?',
      [
        { id: 'loc_academia', title: '🏋️ Academia' },
        { id: 'loc_casa_equip', title: '🏠 Casa c/ equipamentos' },
        { id: 'loc_casa_sem', title: '🧘 Casa sem equipamentos' }
      ]
    );
    
    await this.updateUserState(user.id, 'awaiting_location');
  }
  
  /**
   * Coleta local
   */
  async collectLocation(user, buttonId) {
    const locations = {
      'loc_academia': 'academia',
      'loc_casa_equip': 'casa com equipamentos',
      'loc_casa_sem': 'casa sem equipamentos'
    };
    
    const local = locations[buttonId] || buttonId;
    
    await db.query(
      'UPDATE users SET local_treino = $1 WHERE id = $2',
      [local, user.id]
    );
    
    await messageSender.sendInteractiveButtons(user.phone,
      'Quantos dias por semana você consegue *treinar*?',
      [
        { id: 'freq_3', title: '3️⃣ dias' },
        { id: 'freq_4', title: '4️⃣ dias' },
        { id: 'freq_5', title: '5️⃣ dias' },
        { id: 'freq_6', title: '6️⃣ dias' }
      ]
    );
    
    await this.updateUserState(user.id, 'awaiting_frequency');
  }
  
  /**
   * Coleta frequência e apresenta planos
   */
  async collectFrequency(user, buttonId) {
    const frequencies = {
      'freq_3': 3,
      'freq_4': 4,
      'freq_5': 5,
      'freq_6': 6
    };
    
    const dias = frequencies[buttonId] || parseInt(buttonId);
    
    await db.query(
      'UPDATE users SET dias_semana = $1 WHERE id = $2',
      [dias, user.id]
    );
    
    // Buscar dados atualizados
    const userData = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
    const u = userData.rows[0];
    
    // Apresentar resumo e planos
    await messageSender.sendText(user.phone,
      `✅ *Perfeito, ${u.nome}!*\n\n` +
      `Aqui está seu perfil:\n` +
      `🎯 Objetivo: *${u.objetivo}*\n` +
      `📈 Nível: *${u.nivel}*\n` +
      `📍 Local: *${u.local_treino}*\n` +
      `📅 Frequência: *${u.dias_semana}x por semana*\n\n` +
      `Agora vou te mostrar os planos disponíveis! 💪`
    );
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.presentPlans(user.phone);
    await this.updateUserState(user.id, 'awaiting_plan_choice');
  }
  
  /**
   * Apresenta planos
   */
  async presentPlans(phone) {
    await messageSender.sendText(phone,
      `💎 *PLANOS FIT MOMENTUM*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⭐ *PREMIUM* - R$ 97/mês\n` +
      `✓ Treino 100% personalizado\n` +
      `✓ Vídeos demonstrativos\n` +
      `✓ Ajustes por feedback\n` +
      `✓ Plano nutricional básico\n` +
      `✓ Check-ins semanais\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💙 *BÁSICO* - R$ 49/mês\n` +
      `✓ Treino semanal padronizado\n` +
      `✓ Dicas de hábitos saudáveis\n` +
      `✓ Grupo de apoio\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🎁 *TESTE GRÁTIS* - 3 dias\n` +
      `✓ Experimente o Premium sem compromisso\n\n` +
      `━━━━━━━━━━━━━━━━`
    );
    
    await messageSender.sendInteractiveButtons(phone,
      'Escolha seu plano:',
      [
        { id: 'plan_premium', title: '⭐ PREMIUM' },
        { id: 'plan_basico', title: '💙 BÁSICO' },
        { id: 'plan_teste', title: '🎁 TESTE GRÁTIS' }
      ]
    );
  }
  
  /**
   * Coleta escolha de plano
   */
  async collectPlanChoice(user, buttonId) {
    const plans = {
      'plan_premium': 'premium',
      'plan_basico': 'basico',
      'plan_teste': 'teste'
    };
    
    const plano = plans[buttonId] || buttonId;
    
    if (plano === 'teste') {
      // Ativar teste grátis imediatamente
      await db.query(
        `UPDATE users SET 
         plano = 'premium', 
         status_pagamento = 'teste',
         data_inicio = NOW(),
         data_vencimento = NOW() + INTERVAL '3 days',
         conversation_state = 'active'
         WHERE id = $1`,
        [user.id]
      );
      
      await messageSender.sendText(user.phone,
        `🎉 *Teste Grátis Ativado!*\n\n` +
        `Você tem *3 dias* para experimentar o plano Premium!\n\n` +
        `Amanhã às 6h você receberá seu primeiro treino personalizado. 💪\n\n` +
        `Digite *TREINO* a qualquer momento para receber seu treino do dia!`
      );
      
    } else {
      // Plano pago - enviar instruções de pagamento
      await db.query(
        'UPDATE users SET plano = $1, status_pagamento = $2 WHERE id = $3',
        [plano, 'pending', user.id]
      );
      
      const valor = plano === 'premium' ? 97 : 49;
      
      await messageSender.sendText(user.phone,
        `✅ *Plano ${plano.toUpperCase()} selecionado!*\n\n` +
        `💰 Valor: *R$ ${valor}/mês*\n\n` +
        `📲 Para ativar, faça o pagamento via PIX:\n\n` +
        `[AQUI VOCÊ INTEGRARIA O LINK DE PAGAMENTO]\n\n` +
        `Assim que o pagamento for confirmado, você receberá acesso imediato! 🚀`
      );
    }
  }
  
  /**
   * Processa mensagens de usuário ativo
   */
  async handleActiveUser(user, message) {
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('treino')) {
      await this.sendTodaysWorkout(user);
    } else if (messageLower.includes('progresso')) {
      await this.sendProgressReport(user);
    } else {
      await messageSender.sendText(user.phone,
        `Olá, ${user.nome}! 👋\n\n` +
        `Digite:\n` +
        `• *TREINO* - Receber treino do dia\n` +
        `• *PROGRESSO* - Ver seu progresso\n` +
        `• *AJUDA* - Ver todos os comandos`
      );
    }
  }
  
  /**
   * Envia treino do dia
   */
  async sendTodaysWorkout(user) {
    await messageSender.sendText(user.phone,
      `⚡ Gerando seu treino personalizado...\n\nAguarde alguns segundos! 🤖`
    );
    
    const workout = await workoutGenerator.generatePersonalizedWorkout(user);
    await messageSender.sendWorkout(user.phone, workout);
    
    // Salvar treino no banco
    await db.query(
      `INSERT INTO workouts (user_id, data, titulo, exercicios, duracao_estimada, calorias_estimadas)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
      [user.id, workout.titulo, JSON.stringify(workout), workout.duracao_estimada, workout.calorias_estimadas]
    );
  }
  
  /**
   * Envia mensagem de ajuda
   */
  async sendHelpMessage(phone) {
    await messageSender.sendText(phone,
      `📖 *COMANDOS FIT MOMENTUM*\n\n` +
      `• *TREINO* - Receber treino do dia\n` +
      `• *PROGRESSO* - Ver estatísticas\n` +
      `• *PLANOS* - Ver planos disponíveis\n` +
      `• *AJUDA* - Esta mensagem\n\n` +
      `💬 Ou apenas converse comigo!`
    );
  }
  
  /**
   * Atualiza estado do usuário
   */
  async updateUserState(userId, newState) {
    await db.query(
      'UPDATE users SET conversation_state = $1 WHERE id = $2',
      [newState, userId]
    );
  }
  
  /**
   * Estado desconhecido - reset
   */
  async handleUnknownState(user) {
    await this.updateUserState(user.id, 'new');
    await this.startOnboarding(user);
  }
  
  async sendProgressReport(user) {
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_workouts,
        SUM(CASE WHEN completado THEN 1 ELSE 0 END) as completed_workouts,
        current_streak
       FROM workouts 
       WHERE user_id = $1`,
      [user.id]
    );
    
    const s = stats.rows[0];
    const completionRate = s.total_workouts > 0 
      ? ((s.completed_workouts / s.total_workouts) * 100).toFixed(0) 
      : 0;
    
    await messageSender.sendText(user.phone,
      `📊 *SEU PROGRESSO*\n\n` +
      `✅ Treinos completos: ${s.completed_workouts}\n` +
      `📋 Total de treinos: ${s.total_workouts}\n` +
      `🔥 Sequência atual: ${s.current_streak || 0} dias\n` +
      `📈 Taxa de conclusão: ${completionRate}%\n\n` +
      `Continue assim! 💪`
    );
  }
}

module.exports = new MessageHandler();
