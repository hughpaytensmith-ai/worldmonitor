import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

const TG_API = 'https://api.telegram.org';

async function sendMessage(token, chatId, text) {
  await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'TelegramBot/1.0' },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text).slice(0, 4096),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
}

async function askClaude(apiKey, systemPrompt, userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API HTTP ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '(no response)';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, {});

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!token) return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 503, {});
  if (!anthropicKey) return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 503, {});

  // Validate Telegram webhook secret
  const expectedSecret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET;
  if (expectedSecret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (incoming !== expectedSecret) return jsonResponse({ error: 'Unauthorized' }, 401, {});
  }

  let update;
  try { update = await req.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON' }, 400, {}); }

  const message = update?.message || update?.edited_message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  if (!text || !chatId) return new Response('ok', { status: 200 });

  // Handle built-in commands
  if (text === '/start') {
    await sendMessage(token, chatId, 'Hello! Send me any message and I\'ll respond via Claude.');
    return new Response('ok', { status: 200 });
  }

  // Everything else → Claude
  // Note: webhook handler is stateless — no conversation history.
  // For persistent history, use the Railway relay (polling mode).
  const systemPrompt = process.env.TELEGRAM_BOT_SYSTEM_PROMPT ||
    'You are a helpful assistant. The user is talking to you via Telegram. Be concise.';
  try {
    const reply = await askClaude(anthropicKey, systemPrompt, text);
    await sendMessage(token, chatId, reply);
  } catch (e) {
    await sendMessage(token, chatId, `⚠️ Error: ${e?.message || 'Claude API call failed'}`);
  }

  return new Response('ok', { status: 200 });
}
