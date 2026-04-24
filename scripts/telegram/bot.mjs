#!/usr/bin/env node
/**
 * Standalone Telegram → Claude bot.
 * No dependencies. Copy this file anywhere and run it.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   — from BotFather
 *   ANTHROPIC_API_KEY    — from console.anthropic.com
 *
 * Optional:
 *   TELEGRAM_BOT_SYSTEM_PROMPT — custom instructions for Claude
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... ANTHROPIC_API_KEY=... node bot.mjs
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SYSTEM_PROMPT = process.env.TELEGRAM_BOT_SYSTEM_PROMPT
  || 'You are a helpful assistant. Be concise.';

if (!BOT_TOKEN) { console.error('Missing TELEGRAM_BOT_TOKEN'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const histories = new Map(); // chatId → [{role, content}]

async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function claude(chatId, userText) {
  const history = histories.get(chatId) || [];
  history.push({ role: 'user', content: userText });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history.slice(-20),
    }),
  });

  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
  const data = await r.json();
  const reply = data.content?.[0]?.text || '(no response)';

  history.push({ role: 'assistant', content: reply });
  if (history.length > 20) history.splice(0, history.length - 20);
  histories.set(chatId, history);

  return reply;
}

async function handle(update) {
  const msg = update.message || update.edited_message;
  const text = msg?.text?.trim();
  const chatId = msg?.chat?.id;
  if (!text || !chatId) return;

  if (text === '/start') {
    return tg('sendMessage', { chat_id: chatId, text: 'Hi! Send me anything and I\'ll reply via Claude.' });
  }
  if (text === '/reset') {
    histories.delete(chatId);
    return tg('sendMessage', { chat_id: chatId, text: 'Conversation cleared.' });
  }

  try {
    const reply = await claude(chatId, text);
    await tg('sendMessage', {
      chat_id: chatId,
      text: reply.slice(0, 4096),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (e) {
    await tg('sendMessage', { chat_id: chatId, text: `Error: ${e.message}` });
  }
}

// Long-poll loop
let offset = 0;
let backoff = 2000;
console.log('Bot running. Send a message to your bot on Telegram.');

while (true) {
  try {
    const r = await fetch(
      `${TG}/getUpdates?offset=${offset}&timeout=25&allowed_updates=["message","edited_message"]`,
      { signal: AbortSignal.timeout(35_000) },
    );
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.warn(`getUpdates ${r.status}: ${body.slice(0, 100)}`);
      await new Promise(res => setTimeout(res, backoff));
      backoff = Math.min(backoff * 2, 60_000);
      continue;
    }
    backoff = 2000;
    const { result = [] } = await r.json();
    for (const update of result) {
      offset = update.update_id + 1;
      handle(update).catch(e => console.error('handle error:', e.message));
    }
  } catch (e) {
    if (e?.name !== 'TimeoutError' && e?.name !== 'AbortError') {
      console.warn('Poll error:', e.message);
      await new Promise(res => setTimeout(res, backoff));
      backoff = Math.min(backoff * 2, 60_000);
    }
  }
}
