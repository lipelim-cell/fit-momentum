const express = require('express');
const router = express.Router();
const db = require('../config/database');
const workoutGenerator = require('../services/ai/workoutGenerator');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

// GET /api/users - listar usuários (admin)
router.get('/users', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, phone, nome, objetivo, nivel, plano, status_pagamento, conversation_state, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id - detalhes do usuário
router.get('/users/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, phone, nome, objetivo, nivel, local_treino, dias_semana, plano,
              status_pagamento, conversation_state, intensity_level, current_streak,
              data_vencimento, created_at, last_interaction
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/activate - liberar acesso após confirmação de pagamento
router.post('/users/:id/activate', async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE users SET
         status_pagamento = 'ativo',
         data_inicio = NOW(),
         data_vencimento = NOW() + INTERVAL '30 days',
         conversation_state = 'active',
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    await db.query(
      `UPDATE payments SET status = 'approved', updated_at = NOW()
       WHERE id = (
         SELECT id FROM payments WHERE user_id = $1 AND status = 'pending'
         ORDER BY created_at DESC LIMIT 1
       )`,
      [user.id]
    );

    await messageSender.sendText(user.phone,
      `🎉 *Pagamento confirmado!* Seu plano *${(user.plano || '').toUpperCase()}* está ativo! 💪\n\n` +
      `Digite *TREINO* a qualquer momento para receber seu treino personalizado.`
    );

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id/workouts - histórico de treinos
router.get('/users/:id/workouts', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM workouts WHERE user_id = $1 ORDER BY data DESC LIMIT 30',
      [req.params.id]
    );
    res.json({ workouts: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/workouts/generate - gerar treino manualmente (teste)
router.post('/workouts/generate', async (req, res, next) => {
  try {
    const { userId } = req.body;
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const workout = await workoutGenerator.generatePersonalizedWorkout(userResult.rows[0]);
    res.json({ workout });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/workouts/:id/complete - marcar treino como concluído
router.patch('/workouts/:id/complete', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE workouts SET completado = true, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/stats - estatísticas gerais
router.get('/stats', async (req, res, next) => {
  try {
    const [users, workouts, active] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM workouts'),
      db.query("SELECT COUNT(*) FROM users WHERE conversation_state = 'active'"),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalWorkouts: parseInt(workouts.rows[0].count),
      activeUsers: parseInt(active.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
