export default function handler(req, res) {
  const raw = req.query.d || '';
  let title = '', core = '', link = '';

  if (raw) {
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      title = decoded.title || '';
      core = decoded.core || '';
      link = decoded.link || '';
    } catch {
      // 解码失败则显示空页面
    }
  }

  const linkHtml = link
    ? `<a class="link" href="${escapeHtml(link)}" target="_blank">查看原文 →</a>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title) || '情报详情'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      color: #333;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 24px 20px;
      max-width: 680px;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }
    .tag {
      display: inline-block;
      background: #07c160;
      color: #fff;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.5;
      margin-bottom: 16px;
      color: #111;
    }
    .core {
      font-size: 15px;
      line-height: 1.8;
      color: #444;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .link {
      display: inline-block;
      margin-top: 20px;
      color: #07c160;
      font-size: 14px;
      text-decoration: none;
    }
    .link:active { opacity: 0.7; }
    .empty {
      text-align: center;
      color: #999;
      font-size: 14px;
      padding: 60px 0;
    }
  </style>
</head>
<body>
  <div class="card">
    ${title ? `
    <span class="tag">每日情报</span>
    <h1>${escapeHtml(title)}</h1>
    <div class="core">${escapeHtml(core)}</div>
    ${linkHtml}
    ` : '<div class="empty">内容不存在或链接已失效</div>'}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
