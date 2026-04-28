import axios from 'axios';

const DEFAULT_BASES = ['https://api.coze.com', 'https://api.coze.cn'];

function normalizeEnvValue(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function getCozeConfig() {
  const apiKeyRaw = normalizeEnvValue(process.env.COZE_API_KEY);
  const botId = normalizeEnvValue(process.env.COZE_BOT_ID);
  const cozeApiBase = normalizeEnvValue(process.env.COZE_API_BASE);
  const pollIntervalRaw = Number.parseInt(normalizeEnvValue(process.env.COZE_POLL_INTERVAL_MS), 10);
  const pollTimeoutRaw = Number.parseInt(normalizeEnvValue(process.env.COZE_POLL_TIMEOUT_MS), 10);

  // 支持误填为 "Bearer xxx" 的情况，统一清洗。
  const apiKey = apiKeyRaw.replace(/^Bearer\s+/i, '').trim();
  const pollIntervalMs = Number.isFinite(pollIntervalRaw) && pollIntervalRaw > 0
    ? pollIntervalRaw
    : 1500;
  const pollTimeoutMs = Number.isFinite(pollTimeoutRaw) && pollTimeoutRaw > 0
    ? pollTimeoutRaw
    : 60000;

  return {
    apiKey,
    botId,
    cozeApiBase,
    pollIntervalMs,
    pollTimeoutMs
  };
}

function getCandidateBases(cozeApiBase) {
  if (cozeApiBase) {
    return [cozeApiBase.replace(/\/$/, '')];
  }
  return DEFAULT_BASES;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAnswerFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  const msg = messages.find(
    (item) => item?.role === 'assistant' && item?.type === 'answer'
  );
  const rawContent = typeof msg?.content === 'string' ? msg.content : '';
  if (!rawContent) {
    return '';
  }

  let content = rawContent;

  // 尝试解析 JSON，获取 data 字段
  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed?.data === 'string' && parsed.data.trim()) {
      content = parsed.data;
    }
  } catch {
    // 非 JSON 文本直接使用原文
  }

  // 按 \n 分割，用 '---' 作为段落分隔符格式处理
  const segments = content.split('\n').filter((line) => line.trim());
  return segments.join('\n');
}

async function fetchChatAnswer(baseUrl, apiKey, conversationId, chatId) {
  const messagesResp = await axios.get(`${baseUrl}/v3/chat/message/list`, {
    params: {
      conversation_id: conversationId,
      chat_id: chatId
    },
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  });

  if (messagesResp.data?.code && messagesResp.data.code !== 0) {
    throw new Error(`Coze message list failed: ${messagesResp.data.msg || messagesResp.data.code}`);
  }

  return extractAnswerFromMessages(messagesResp.data?.data);
}

async function requestCoze(baseUrl, apiKey, botId, message, userId, pollIntervalMs, pollTimeoutMs) {
  const startResp = await axios.post(
    `${baseUrl}/v3/chat`,
    {
      bot_id: botId,
      user_id: userId || 'default_user',
      stream: false,
      auto_save_history: true,
      additional_messages: [
        {
          role: 'user',
          type: 'question',
          content: message,
          content_type: 'text'
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  );

  if (startResp.data?.code && startResp.data.code !== 0) {
    throw new Error(`Coze chat create failed: ${startResp.data.msg || startResp.data.code}`);
  }

  const data = startResp.data?.data || {};
  const chatId = data.id || data.chat_id || startResp.data?.id;
  const conversationId = data.conversation_id || startResp.data?.conversation_id;

  const directAnswer =
    extractAnswerFromMessages(data.messages) ||
    extractAnswerFromMessages(startResp.data?.messages) ||
    data.answer ||
    startResp.data?.answer ||
    '';

  if (directAnswer) {
    return directAnswer;
  }

  if (!chatId || !conversationId) {
    throw new Error('Coze response missing chat_id or conversation_id');
  }

  const deadline = Date.now() + pollTimeoutMs;
  let lastStatus = 'created';

  while (Date.now() < deadline) {
    const retrieveResp = await axios.get(`${baseUrl}/v3/chat/retrieve`, {
      params: {
        chat_id: chatId,
        conversation_id: conversationId
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (retrieveResp.data?.code && retrieveResp.data.code !== 0) {
      throw new Error(`Coze chat retrieve failed: ${retrieveResp.data.msg || retrieveResp.data.code}`);
    }

    const status = retrieveResp.data?.data?.status;
    lastStatus = status || lastStatus;
    const lastError = retrieveResp.data?.data?.last_error;

    if (status === 'failed') {
      throw new Error(`Coze chat failed: ${lastError?.msg || 'unknown error'}`);
    }

    if (status === 'requires_action') {
      throw new Error('Coze chat requires tool outputs, current flow does not support it');
    }

    if (status === 'canceled') {
      throw new Error('Coze chat canceled');
    }

    if (status === 'completed') {
      const answer = await fetchChatAnswer(baseUrl, apiKey, conversationId, chatId);
      return answer || '暂无回复';
    }

    await sleep(pollIntervalMs);
  }

  const fallbackAnswer = await fetchChatAnswer(baseUrl, apiKey, conversationId, chatId).catch(() => '');
  if (fallbackAnswer) {
    return fallbackAnswer;
  }

  throw new Error(
    `Coze chat timeout while waiting for completion (status=${lastStatus}, timeoutMs=${pollTimeoutMs})`
  );
}

/**
 * 调用Coze API获取AI回复
 * @param {string} message - 用户消息
 * @param {string} userId - 用户ID（用于对话上下文）
 * @returns {Promise<string>} AI回复内容
 */
export async function askCoze(message, userId) {
  try {
    const { apiKey, botId, cozeApiBase, pollIntervalMs, pollTimeoutMs } = getCozeConfig();

    if (!apiKey || !botId) {
      console.error('Missing Coze credentials');
      return '抱歉，服务暂时不可用。';
    }

    const bases = getCandidateBases(cozeApiBase);
    let lastError;

    for (const baseUrl of bases) {
      try {
        return await requestCoze(
          baseUrl,
          apiKey,
          botId,
          message,
          userId,
          pollIntervalMs,
          pollTimeoutMs
        );
      } catch (error) {
        lastError = error;

        if (error?.response?.status === 404) {
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('All Coze API endpoints failed');
  } catch (error) {
    console.error('Coze API Error:', error.response?.data || error.message);
    return '抱歉，处理您的请求时出错了。';
  }
}
