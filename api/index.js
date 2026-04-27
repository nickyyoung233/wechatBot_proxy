import { verifyWeChat, parseWeChatMessage, createWeChatReply } from './wechat.js';
import { askCoze } from './coze.js';

/**
 * 从请求流读取原始 body（用于 text/xml 场景兜底）
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * 处理GET请求 - WeChat服务器验证
 */
async function handleGet(req) {
  const { signature, timestamp, nonce, echostr } = req.query;

  if (!signature || !timestamp || !nonce) {
    return {
      statusCode: 400,
      body: 'Missing required parameters'
    };
  }

  if (verifyWeChat(signature, timestamp, nonce)) {
    return {
      statusCode: 200,
      body: echostr || 'success'
    };
  }

  return {
    statusCode: 403,
    body: 'Invalid signature'
  };
}

/**
 * 处理POST请求 - 接收并回复WeChat消息
 */
async function handlePost(req) {
  try {
    const { signature, timestamp, nonce } = req.query;

    if (!verifyWeChat(signature, timestamp, nonce)) {
      return {
        statusCode: 403,
        body: 'Invalid signature'
      };
    }

    let body = req.body;

    if (typeof body === 'string') {
      // 保持不变
    } else if (Buffer.isBuffer(body)) {
      body = body.toString('utf8');
    } else if (body == null) {
      body = await readRawBody(req);
    } else {
      return {
        statusCode: 400,
        body: 'Invalid request body type'
      };
    }

    if (!body || !body.trim()) {
      return {
        statusCode: 400,
        body: 'Empty request body'
      };
    }

    const message = await parseWeChatMessage(body);
    console.log('Received message:', message);

    if (message.msgType !== 'text') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/xml' },
        body: createWeChatReply(message.fromUser, message.toUser, '暂只支持文本消息')
      };
    }

    const aiResponse = await askCoze(message.content, message.fromUser);
    const xmlReply = createWeChatReply(message.fromUser, message.toUser, aiResponse);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml' },
      body: xmlReply
    };
  } catch (error) {
    console.error('Error handling POST request:', error);

    return {
      statusCode: 500,
      body: 'Internal server error'
    };
  }
}

/**
 * Vercel Serverless Function
 */
export default async function handler(req, res) {
  try {
    let response;

    if (req.method === 'GET') {
      response = await handleGet(req);
    } else if (req.method === 'POST') {
      response = await handlePost(req);
    } else {
      response = {
        statusCode: 405,
        body: 'Method not allowed'
      };
    }

    res.status(response.statusCode);
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.send(response.body);
  } catch (error) {
    console.error('Unhandled error:', error);
    res.status(500).send('Internal server error');
  }
}