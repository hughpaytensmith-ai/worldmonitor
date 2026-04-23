# Telegram Bot Integration — Coworker Context

## What this project is

**WorldMonitor** (`hughpaytensmith-ai/worldmonitor`) is a real-time global intelligence dashboard.
Key infrastructure:
- **Vercel** — hosts the frontend SPA and stateless Edge API functions (`api/*.js`)
- **Railway** — runs `scripts/ais-relay.cjs`, a persistent Node.js relay that handles live data (AIS vessels, Telegram OSINT, weather alerts, market data, etc.)
- **Telegram OSINT** — the relay already reads public Telegram channels via MTProto (gramjs) and serves them at `/telegram/feed`. This is separate from the bot.

---

## What was built (all merged to `main`)

A Telegram Bot API integration was added on top of the existing relay. Three files were created/modified:

### 1. `api/telegram-bot-webhook.js` — Vercel Edge Function
Receives POST webhook calls from Telegram. Handles commands:
- `/start` — welcome message
- `/help` — list commands
- `/status` — relay health (calls relay `/metrics`)
- `/feed [topic]` — latest OSINT signals (calls relay `/telegram/feed`)
- `/alerts` — conflict signals (calls relay `/telegram/feed?topic=conflict`)

Validates `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_BOT_WEBHOOK_SECRET` env var.
Calls relay endpoints using existing `WS_RELAY_URL` + `RELAY_SHARED_SECRET`.

### 2. `scripts/ais-relay.cjs` — additions to the Railway relay
Three additions:
- **`sendTelegramBotMessage(chatId, text)`** — sends a message via Bot API
- **`broadcastBotAlert(text)`** — sends to all `TELEGRAM_BOT_ALERT_CHAT_IDS` (not yet wired to events)
- **`startTelegramBotPollLoop()`** — long-polling fallback (for Railway/local). Uses `getUpdates` with 25s timeout, exponential backoff on errors (2s→60s), self-disables on 409 Conflict (when webhook is active)
- **`POST /telegram/bot/send`** — internal HTTP endpoint (relay-auth protected) to trigger bot messages from anywhere in the system

### 3. `scripts/telegram/setup-bot-webhook.mjs` — CLI setup script
Run once from a machine with internet access:
```
node scripts/telegram/setup-bot-webhook.mjs init          # register commands + description in Telegram UI
node scripts/telegram/setup-bot-webhook.mjs set <url>     # register webhook URL with Telegram
node scripts/telegram/setup-bot-webhook.mjs get           # inspect current webhook
node scripts/telegram/setup-bot-webhook.mjs delete        # remove webhook (reverts to polling)
```

### 4. `.env.example` — three new variables documented
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_WEBHOOK_SECRET=
TELEGRAM_BOT_ALERT_CHAT_IDS=
```

---

## Architecture: polling vs webhook

**Current state:** The relay runs a long-polling loop (`getUpdates`) automatically when `TELEGRAM_BOT_TOKEN` is set. This works on Railway with zero extra setup but is single-instance only.

**Target state (production):** Webhook on Vercel. Telegram POSTs updates directly to `https://<domain>/api/telegram-bot-webhook`. Vercel is stateless and scales horizontally. When the webhook is registered, the relay's polling loop detects the 409 Conflict response and shuts itself down automatically — no manual change needed.

---

## Current state (as of this handoff)

- ✅ Code merged to `main`
- ✅ Vercel auto-deploying (check Vercel dashboard for completion)
- ❌ `TELEGRAM_BOT_TOKEN` not set in Railway or Vercel
- ❌ `TELEGRAM_BOT_WEBHOOK_SECRET` not set in Vercel
- ❌ Webhook not registered with Telegram
- ❌ Bot commands not registered in Telegram UI (`/init` not run yet)
- ⚠️ **Bot token must be rotated** — the token was shared in plain text during development and is compromised

---

## Exact steps to complete activation

### Step 1 — Rotate the bot token (URGENT)
The current token is compromised. Message [@BotFather](https://t.me/BotFather):
```
/mybots → select @Hughpaytensmith_bot → API Token → Revoke current token
```
Copy the new token. Use it everywhere below.

### Step 2 — Set Railway environment variables
In the Railway dashboard for the relay service, add:
```
TELEGRAM_BOT_TOKEN=<new-token-from-step-1>
TELEGRAM_BOT_ALERT_CHAT_IDS=<optional: comma-separated chat IDs for push alerts>
```
Redeploy (or Railway auto-redeploys on env change). You'll see in logs:
```
[Relay] Telegram Bot long-poll loop started
```
The bot is now live via polling. Test it by messaging @Hughpaytensmith_bot with `/start`.

### Step 3 — Set Vercel environment variables
In Vercel dashboard → Project → Settings → Environment Variables:
```
TELEGRAM_BOT_TOKEN=<same-new-token>
TELEGRAM_BOT_WEBHOOK_SECRET=<generate: openssl rand -hex 32>
```
Note the secret — you'll need it in Step 4.

### Step 4 — Register bot commands and switch to webhook
Run from a local machine (needs internet access, `git pull` first):
```bash
cd worldmonitor
export TELEGRAM_BOT_TOKEN=<new-token>
export TELEGRAM_BOT_WEBHOOK_SECRET=<same-secret-as-vercel>

# Register commands so they appear in Telegram's "/" picker
node scripts/telegram/setup-bot-webhook.mjs init

# Register the webhook (use your actual Vercel URL)
node scripts/telegram/setup-bot-webhook.mjs set https://<your-vercel-domain>/api/telegram-bot-webhook

# Verify
node scripts/telegram/setup-bot-webhook.mjs get
```
After this, the relay's polling loop stops itself automatically and all traffic goes through Vercel.

### Step 5 — Optional: set bot profile via BotFather
```
/mybots → @Hughpaytensmith_bot → Edit Bot → Edit Description / Edit About / Edit Botpic
```

---

## Environment variable reference

| Variable | Where | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Railway + Vercel | Bot API token from BotFather |
| `TELEGRAM_BOT_WEBHOOK_SECRET` | Vercel only | Random string; Telegram sends it in `X-Telegram-Bot-Api-Secret-Token` header to authenticate webhook calls |
| `TELEGRAM_BOT_ALERT_CHAT_IDS` | Railway only | Comma-separated chat IDs to receive push alerts from relay events |

## Existing variables (already set, do not change)
| Variable | Purpose |
|---|---|
| `WS_RELAY_URL` | Vercel → Railway relay URL; webhook handler uses this to fetch feed/status data |
| `RELAY_SHARED_SECRET` | Auth between Vercel and Railway relay |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION` | MTProto OSINT (separate from bot — reads public channels) |

---

## Key file locations

```
api/telegram-bot-webhook.js              — Vercel webhook handler
scripts/ais-relay.cjs                    — Railway relay (search: "Telegram Bot API")
scripts/telegram/setup-bot-webhook.mjs  — setup CLI
scripts/telegram/session-auth.mjs       — existing MTProto session tool (unrelated)
.env.example                             — all env vars documented
```

## Bot username
[@Hughpaytensmith_bot](https://t.me/Hughpaytensmith_bot)
