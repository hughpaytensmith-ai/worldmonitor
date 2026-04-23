#!/usr/bin/env node
/**
 * Register (or inspect/delete) the Telegram Bot webhook URL.
 *
 * Prerequisites:
 *   TELEGRAM_BOT_TOKEN          — from BotFather
 *   TELEGRAM_BOT_WEBHOOK_SECRET — random string, also set in Vercel env
 *
 * Usage:
 *   # Set webhook (replace URL with your Vercel deployment)
 *   TELEGRAM_BOT_TOKEN=<token> TELEGRAM_BOT_WEBHOOK_SECRET=<secret> \
 *     node scripts/telegram/setup-bot-webhook.mjs set https://worldmonitor.app/api/telegram-bot-webhook
 *
 *   # Inspect current webhook
 *   TELEGRAM_BOT_TOKEN=<token> node scripts/telegram/setup-bot-webhook.mjs get
 *
 *   # Remove webhook (reverts to polling mode)
 *   TELEGRAM_BOT_TOKEN=<token> node scripts/telegram/setup-bot-webhook.mjs delete
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

const [, , command, webhookUrl] = process.argv;

switch (command) {
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
    console.log('  setup-bot-webhook.mjs set <webhook-url>   — register webhook');
    console.log('  setup-bot-webhook.mjs get                 — inspect current webhook');
    console.log('  setup-bot-webhook.mjs delete              — remove webhook');
    process.exit(1);
}
