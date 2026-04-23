#!/usr/bin/env node
/**
 * Telegram Bot setup: register webhook, commands, and bot profile.
 *
 * Prerequisites:
 *   TELEGRAM_BOT_TOKEN          — from BotFather
 *   TELEGRAM_BOT_WEBHOOK_SECRET — random string, also set in Vercel env
 *
 * Commands:
 *   init                        — register bot commands in Telegram UI
 *   set <url>                   — register webhook URL with Telegram
 *   get                         — inspect current webhook info
 *   delete                      — remove webhook (reverts to polling)
 *
 * Full setup sequence (run after merging PR and deploying to Vercel):
 *   export TELEGRAM_BOT_TOKEN=<token>
 *   export TELEGRAM_BOT_WEBHOOK_SECRET=$(openssl rand -hex 32)
 *   node scripts/telegram/setup-bot-webhook.mjs init
 *   node scripts/telegram/setup-bot-webhook.mjs set https://<your-domain>/api/telegram-bot-webhook
 */

const TG_API = 'https://api.telegram.org';

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET;

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN. Set it in your environment.');
  process.exit(1);
}

async function callApi(method, body) {
  const url = `${TG_API}/bot${token}/${method}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data.result;
}

const BOT_COMMANDS = [
  { command: 'start',  description: 'Welcome message' },
  { command: 'help',   description: 'List available commands' },
  { command: 'status', description: 'Relay health overview' },
  { command: 'feed',   description: 'Latest early signals (optional: /feed conflict)' },
  { command: 'alerts', description: 'Recent conflict signals from the feed' },
];

const [, , command, webhookUrl] = process.argv;

switch (command) {
  case 'init': {
    const cmdResult = await callApi('setMyCommands', { commands: BOT_COMMANDS });
    console.log('✅ Bot commands registered:', cmdResult);
    const descResult = await callApi('setMyDescription', {
      description: 'Real-time global intelligence: conflict signals, market alerts, relay health — straight to Telegram.',
    });
    console.log('✅ Bot description set:', descResult);
    break;
  }

  case 'set': {
    if (!webhookUrl) {
      console.error('Usage: setup-bot-webhook.mjs set <https://your-domain/api/telegram-bot-webhook>');
      process.exit(1);
    }
    if (!secret) {
      console.warn('Warning: TELEGRAM_BOT_WEBHOOK_SECRET is not set. Webhook will be unprotected.');
    }
    const params = { url: webhookUrl, allowed_updates: ['message', 'edited_message'] };
    if (secret) params.secret_token = secret;
    const result = await callApi('setWebhook', params);
    console.log('✅ Webhook set successfully:', result);
    console.log('   URL:', webhookUrl);
    if (secret) console.log('   Secret token registered.');
    break;
  }

  case 'get': {
    const info = await callApi('getWebhookInfo');
    console.log('Webhook info:', JSON.stringify(info, null, 2));
    break;
  }

  case 'delete': {
    const result = await callApi('deleteWebhook', { drop_pending_updates: false });
    console.log('✅ Webhook deleted:', result);
    break;
  }

  default:
    console.log('Usage:');
    console.log('  setup-bot-webhook.mjs init                — register bot commands + description');
    console.log('  setup-bot-webhook.mjs set <webhook-url>   — register webhook');
    console.log('  setup-bot-webhook.mjs get                 — inspect current webhook');
    console.log('  setup-bot-webhook.mjs delete              — remove webhook (reverts to polling)');
    process.exit(1);
}
