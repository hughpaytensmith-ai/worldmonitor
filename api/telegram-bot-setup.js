/**
 * One-shot webhook self-registration.
 * Visit: https://<your-domain>/api/telegram-bot-setup?secret=<TELEGRAM_BOT_WEBHOOK_SECRET>
 * The endpoint detects its own URL and registers it as the Telegram webhook.
 */

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET;

  if (!token) {
    return Response.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 });
  }

  // Protect with the webhook secret so random visitors can't trigger it
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') || '';
  if (!webhookSecret || provided !== webhookSecret) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // Derive the webhook URL from this request's own host
  const webhookUrl = `${url.protocol}//${url.host}/api/telegram-bot-webhook`;

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message'],
      secret_token: webhookSecret,
    }),
  });

  const tgData = await tgRes.json();

  if (!tgData.ok) {
    return Response.json({ error: 'Telegram API error', detail: tgData }, { status: 502 });
  }

  // Also register bot commands so they appear in Telegram's / picker
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Start the bot' },
        { command: 'reset', description: 'Clear conversation history' },
      ],
    }),
  });

  return Response.json({
    ok: true,
    webhook: webhookUrl,
    telegram: tgData,
  });
}
