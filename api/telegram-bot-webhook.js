import { getRelayBaseUrl, getRelayHeaders, fetchWithTimeout } from './_relay.js';
import { jsonResponse } from './_json-response.js';

export const config = { runtime: 'edge' };

const TG_API = 'https://api.telegram.org';

const TG_MAX_TEXT = 4096;

async function callBotApi(token, method, body) {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'WorldMonitor-Bot/1.0' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.warn(`[Bot] ${method} HTTP ${res.status}`);
  return res.ok;
}

function sendMessage(token, chatId, text, extra = {}) {
  return callBotApi(token, 'sendMessage', {
    chat_id: chatId,
    text: String(text).slice(0, TG_MAX_TEXT),
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...extra,
  });
}

async function handleCommand(token, chatId, command, args, relayBase) {
  switch (command) {
    case '/start':
      return sendMessage(token, chatId,
        '*World Monitor Bot*\n\nReal-time global intelligence at your fingertips.\n\nType /help to see available commands.',
      );

    case '/help':
      return sendMessage(token, chatId,
        '*Commands*\n\n' +
        '/status — Relay health overview\n' +
        '/feed — Latest early signals (add a topic, e.g. `/feed conflict`)\n' +
        '/alerts — Recent weather & conflict alerts from the feed\n' +
        '/help — This message',
      );

    case '/status': {
      if (!relayBase) return sendMessage(token, chatId, '⚠️ Relay not configured.');
      try {
        const res = await fetchWithTimeout(`${relayBase}/metrics`, { headers: getRelayHeaders({ Accept: 'application/json' }) }, 8000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tg = data?.telegram;
        const lines = [
          '*Relay Status*',
          `✅ Online`,
          tg?.enabled
            ? `📡 Telegram OSINT: enabled (${tg.itemCount ?? 0} items)`
            : `📡 Telegram OSINT: disabled`,
        ];
        if (tg?.lastPollAt) {
          lines.push(`🕐 Last poll: ${new Date(tg.lastPollAt).toUTCString().replace(' GMT', ' UTC')}`);
        }
        return sendMessage(token, chatId, lines.join('\n'));
      } catch (e) {
        return sendMessage(token, chatId, `⚠️ Could not reach relay: ${e?.message || String(e)}`);
      }
    }

    case '/feed':
    case '/alerts': {
      if (!relayBase) return sendMessage(token, chatId, '⚠️ Relay not configured.');
      try {
        const topic = command === '/alerts' ? 'conflict' : (args[0] || '');
        const params = new URLSearchParams({ limit: '5' });
        if (topic) params.set('topic', topic);
        const res = await fetchWithTimeout(
          `${relayBase}/telegram/feed?${params}`,
          { headers: getRelayHeaders({ Accept: 'application/json' }) },
          12000,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = data?.items;
        if (!items?.length) {
          return sendMessage(token, chatId, topic ? `No recent signals for topic: _${topic}_` : 'No recent signals.');
        }
        const header = command === '/alerts' ? '*Recent Conflict/Alert Signals*' : `*Recent Signals${topic ? ` — ${topic}` : ''}*`;
        const lines = [header];
        for (const item of items.slice(0, 5)) {
          const ch = item.channel ? `[${item.channel}] ` : '';
          const body = (item.text || '').replace(/\*/g, '').replace(/_/g, '').slice(0, 160);
          lines.push(`\n• ${ch}${body}`);
        }
        return sendMessage(token, chatId, lines.join(''));
      } catch (e) {
        return sendMessage(token, chatId, `⚠️ Could not fetch feed: ${e?.message || String(e)}`);
      }
    }

    default:
      return false;
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, {});
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'TELEGRAM_BOT_TOKEN not configured' }, 503, {});
  }

  // Validate the secret Telegram sends in the header (set via setWebhook secret_token param).
  const expectedSecret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET;
  if (expectedSecret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (incoming !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401, {});
    }
  }

  let update;
  try {
    update = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, {});
  }

  const message = update?.message || update?.edited_message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;

  if (!text || !chatId) {
    return new Response('ok', { status: 200 });
  }

  // Extract command — strip bot username suffix if present (e.g. /start@Hughpaytensmith_bot)
  const rawCommand = text.split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase();
  const args = text.split(/\s+/).slice(1);
  const relayBase = getRelayBaseUrl();

  await handleCommand(token, chatId, rawCommand, args, relayBase);

  return new Response('ok', { status: 200 });
}
