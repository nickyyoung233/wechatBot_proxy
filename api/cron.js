import { askCoze } from './coze.js';
import { pushWeChatMessage } from './wechatPush.js';

/**
 * Vercel Cron Job 入口
 * 
 * vercel.json 中 cron 设置为 "0 * * * *"（每小时整点触发），
 * 实际执行时机由环境变量 SCHEDULED_HOUR_UTC（0-23）控制，
 * 这样无需改代码即可通过 Vercel 环境变量调整每天推送时间。
 * 
 * 本地手动触发：GET /api/cron?force=1
 */
export default async function handler(req, res) {
  // Vercel Cron 会在请求头携带 Authorization: Bearer <CRON_SECRET>
  // 非 force 模式下验证请求来源安全性
  const isForced = req.query.force === '1';

  if (!isForced) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  // 检查当前 UTC 小时是否匹配计划时间
  const scheduledHour = parseInt(process.env.SCHEDULED_HOUR_UTC ?? '2', 10);
  const nowHour = new Date().getUTCHours();

  if (!isForced && nowHour !== scheduledHour) {
    return res.status(200).json({
      message: `Skipped. Current UTC hour: ${nowHour}, scheduled: ${scheduledHour}`
    });
  }

  const openid = process.env.WECHAT_PUSH_OPENID;
  if (!openid) {
    console.error('WECHAT_PUSH_OPENID is not set');
    return res.status(500).json({ error: 'WECHAT_PUSH_OPENID not configured' });
  }

  const prompt = process.env.CRON_PROMPT || '【定时任务触发】：现在请开始执行今日前端技术情报总结。';

  try {
    console.log(`[Cron] Calling Coze with prompt: "${prompt}"`);
    const aiResponse = await askCoze(prompt, 'cron_scheduled_task');

    console.log(`[Cron] Pushing message to WeChat OpenID: ${openid}`);
    await pushWeChatMessage(openid, aiResponse);

    console.log('[Cron] Done');
    return res.status(200).json({ message: 'Pushed successfully' });
  } catch (error) {
    console.error('[Cron] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
