const db = require('../config/database');
const messageSender = require('../services/whatsapp/messageSender');
const logger = require('../utils/logger');

class ProgressAgent {
  async sendReport(user) {
    logger.info(`[Progress] Relatório para user ${user.id}`);

    const { rows } = await db.query(
      `SELECT
         COUNT(w.id)                                       AS total_workouts,
         SUM(CASE WHEN w.completado THEN 1 ELSE 0 END)    AS completed_workouts,
         u.current_streak
       FROM users u
       LEFT JOIN workouts w ON w.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.current_streak`,
      [user.id]
    );

    const s = rows[0] || { total_workouts: 0, completed_workouts: 0, current_streak: 0 };

    const total = parseInt(s.total_workouts) || 0;
    const completed = parseInt(s.completed_workouts) || 0;
    const streak = parseInt(s.current_streak) || 0;
    const rate = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;

    await messageSender.sendText(user.phone,
      `📊 *SEU PROGRESSO, ${user.nome}*\n\n` +
      `✅ Treinos completos: *${completed}*\n` +
      `📋 Total de treinos: *${total}*\n` +
      `🔥 Sequência atual: *${streak} dias*\n` +
      `📈 Taxa de conclusão: *${rate}%*\n\n` +
      `Continue assim! 💪`
    );
  }
}

module.exports = new ProgressAgent();
