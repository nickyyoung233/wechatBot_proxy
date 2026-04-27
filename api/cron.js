import { askCoze } from './coze.js';
import { pushWeChatMessage } from './wechatPush.js';

/**
 * Vercel Cron Job 入口
 *
 * vercel.json 中 cron 设置为 "* * * * *"（每分钟触发），
 * 实际执行时机由环境变量 SCHEDULED_HOUR_UTC（0-23）和
 * SCHEDULED_MINUTE_UTC（0-59）共同控制。
 *
 * 本地手动触发：GET /api/cron?force=1
 */
export default async function handler(req, res) {
  const isForced = req.query.force === '1';

  if (!isForced) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  const scheduledHour = parseInt(process.env.SCHEDULED_HOUR_UTC ?? '2', 10);
  const scheduledMinute = parseInt(process.env.SCHEDULED_MINUTE_UTC ?? '0', 10);

  if (
    Number.isNaN(scheduledHour) ||
    Number.isNaN(scheduledMinute) ||
    scheduledHour < 0 ||
    scheduledHour > 23 ||
    scheduledMinute < 0 ||
    scheduledMinute > 59
  ) {
    return res.status(500).json({
      error: 'Invalid SCHEDULED_HOUR_UTC or SCHEDULED_MINUTE_UTC'
    });
  }

  const now = new Date();
  const nowHour = now.getUTCHours();
  const nowMinute = now.getUTCMinutes();

  if (!isForced && (nowHour !== scheduledHour || nowMinute !== scheduledMinute)) {
    return res.status(200).json({
      message: `Skipped. Current UTC: ${String(nowHour).padStart(2, '0')}:${String(nowMinute).padStart(2, '0')}, scheduled: ${String(scheduledHour).padStart(2, '0')}:${String(scheduledMinute).padStart(2, '0')}`
    });
  }

  const openid = process.env.WECHAT_PUSH_OPENID;
  if (!openid) {
    console.error('WECHAT_PUSH_OPENID is not set');
    return res.status(500).json({ error: 'WECHAT_PUSH_OPENID not configured' });
  }

  const prompt =
    process.env.CRON_PROMPT || '【定时任务触发】：现在请开始执行今日前端技术情报总结。';

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