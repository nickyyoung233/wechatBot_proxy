export default function handler(req, res) {
  const host = req.headers?.host || process.env.VERCEL_URL || 'localhost';
  const baseUrl = host.startsWith('http') ? host : `https://${host}`;
  const searchParams = new URL(req.url || '/', baseUrl).searchParams;
  const raw = searchParams.get('d') || '';
  let content = '';

  if (raw) {
    try {
      const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (typeof decoded.content === 'string') {
        content = decoded.content;
      } else {
        const title = decoded.title || '';
        const core = decoded.core || '';
        const link = decoded.link || '';
        if (title || core || link) {
          content = `标题：${title}\n核心：${core}${link ? `\n链接：${link}` : ''}`;
        }
      }
    } catch {
      // 解码失败则显示空页面
    }
  }

  const items = parseNewsItems(content);
  const itemsHtml = renderItems(items, content);
  const pageTitle = items[0]?.title || '情报详情';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      color: #333;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
    }
    .header {
      background: #fff;
      border-radius: 12px;
      padding: 24px 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      margin-bottom: 14px;
    }
    .tag {
      display: inline-block;
      background: #07c160;
      color: #fff;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    h1 {
      font-size: 19px;
      font-weight: 700;
      line-height: 1.5;
      color: #111;
    }
    .sub {
      margin-top: 8px;
      color: #666;
      font-size: 13px;
    }
    .item {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      padding: 18px 16px;
      margin-bottom: 12px;
    }
    .item h2 {
      font-size: 16px;
      line-height: 1.55;
      color: #111;
      margin-bottom: 10px;
    }
    .core {
      font-size: 14px;
      line-height: 1.8;
      color: #444;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 12px;
    }
    .url {
      color: #666;
      font-size: 12px;
      line-height: 1.5;
      word-break: break-all;
      margin-top: 8px;
    }
    .link-btn {
      display: inline-block;
      border-radius: 8px;
      background: #07c160;
      color: #fff;
      font-size: 13px;
      padding: 8px 12px;
      text-decoration: none;
    }
    .link-btn:active {
      opacity: 0.8;
    }
    .empty {
      text-align: center;
      color: #999;
      font-size: 14px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      padding: 60px 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="tag">每日情报</span>
      <h1>前端资讯详情</h1>
      <div class="sub">点击按钮可直接跳转查看原文</div>
    </div>
    ${itemsHtml}
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

function parseNewsItems(content) {
  if (!content || !content.trim()) return [];

  const items = [];
  const blocks = content.trim().split(/(?=^标题[：:])/m);

  for (const block of blocks) {
    const lines = block.split('\n');
    let title = '';
    let core = '';
    let link = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^标题[：:]/.test(trimmed)) {
        title = trimmed.replace(/^标题[：:]\s*/, '');
      } else if (/^核心[：:]/.test(trimmed)) {
        core = trimmed.replace(/^核心[：:]\s*/, '');
      } else if (/^链接[：:]/.test(trimmed)) {
        link = trimmed.replace(/^链接[：:]\s*/, '');
      }
    }

    if (title || core || link) {
      items.push({ title, core, link });
    }
  }

  return items;
}

function renderItems(items, content) {
  if (items.length === 0) {
    if (!content || !content.trim()) {
      return '<div class="empty">内容不存在或链接已失效</div>';
    }

    return `
      <div class="item">
        <h2>资讯内容</h2>
        <div class="core">${escapeHtml(content)}</div>
      </div>
    `;
  }

  return items.map((item, idx) => {
    const title = item.title || `资讯 ${idx + 1}`;
    const core = item.core || '暂无摘要';
    const urlText = item.link ? escapeHtml(item.link) : '无原文链接';
    const actionBtn = item.link
      ? `<a class="link-btn" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">查看原文</a>`
      : '';

    return `
      <div class="item">
        <h2>${idx + 1}. ${escapeHtml(title)}</h2>
        <div class="core">${escapeHtml(core)}</div>
        ${actionBtn}
        <div class="url">${urlText}</div>
      </div>
    `;
  }).join('');
}
