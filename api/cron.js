import { askCoze } from './coze.js';
import { pushWeChatMessages } from './wechatPush.js';

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
  const nowIso = new Date().toISOString();
  const userAgent = req.headers['user-agent'] || '';
  const vercelId = req.headers['x-vercel-id'] || '';
  const hasAuthHeader = Boolean(req.headers.authorization);
  const source = isForced
    ? 'manual-force'
    : userAgent.toLowerCase().includes('vercel')
      ? 'vercel-cron-like'
      : 'external-request';

  console.log('[Cron] Incoming request', {
    nowIso,
    source,
    isForced,
    path: req.url,
    query: req.query,
    hasAuthHeader,
    userAgent,
    vercelId
  });

  if (!isForced) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cron] Unauthorized request', {
          nowIso,
          source,
          path: req.url,
          hasAuthHeader,
          userAgent,
          vercelId
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
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
    await pushWeChatMessages(openid, aiResponse);

    console.log('[Cron] Done');
    return res.status(200).json({ message: 'Pushed successfully' });
  } catch (error) {
    console.error('[Cron] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}