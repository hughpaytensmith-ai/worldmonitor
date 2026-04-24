# Telegram Bot Setup — Coworker Context

## What this is

A Telegram bot that bridges the user's Telegram account to the Claude AI API.
The user sends any message to the bot on Telegram → Claude responds → reply comes back on Telegram.

**This has nothing to do with the WorldMonitor dashboard.** It lives in this repo because
the Railway relay (`scripts/ais-relay.cjs`) is the convenient always-on process to run it from,
but the bot logic is completely self-contained.

---

## How it works

```
User → Telegram → [bot token] → Railway relay (long-polling) → Anthropic API → reply back
                                        OR
User → Telegram → [webhook]   → Vercel edge function          → Anthropic API → reply back
```

Two modes — same end result:

| Mode | Where | When to use |
|---|---|---|
| **Long-polling** (relay) | Railway `ais-relay.cjs` | Dev / Railway-only setups. Runs automatically when `TELEGRAM_BOT_TOKEN` + `ANTHROPIC_API_KEY` are set. Keeps conversation history in memory per chat. |
| **Webhook** (Vercel) | `api/telegram-bot-webhook.js` | Production. Telegram pushes updates to Vercel. Stateless (no history). Relay polling auto-stops on 409 when webhook is active. |

---

## Current state

- ✅ All code merged to `main`
- ✅ Vercel auto-deployed
- ❌ `TELEGRAM_BOT_TOKEN` not set anywhere
- ❌ `ANTHROPIC_API_KEY` not set in Railway (already set in Vercel for widget builder — confirm)
- ❌ Webhook not registered with Telegram
- ⚠️ **Original bot token is compromised** — was shared in plain text. Must rotate before use.

---

## Activation steps

### Step 1 — Rotate the bot token
The token that was created was shared publicly and must be replaced.

Message [@BotFather](https://t.me/BotFather) on Telegram:
```
/mybots → select @Hughpaytensmith_bot → API Token → Revoke current token
```
Copy the new token.

### Step 2 — Set Railway environment variables
In the Railway dashboard, add to the relay service:
```
TELEGRAM_BOT_TOKEN=<new-token>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

Optional — customise what Claude says:
```
TELEGRAM_BOT_SYSTEM_PROMPT=You are a helpful task manager. When given a task, acknowledge it and suggest next steps.
```

Redeploy. You'll see in Railway logs:
```
[Bot] Telegram → Claude bridge started
```

Test immediately: message [@Hughpaytensmith_bot](https://t.me/Hughpaytensmith_bot) with anything.
Use `/reset` to clear conversation history.

### Step 3 — Switch to production webhook (optional but recommended)

**3a. Set Vercel environment variables:**
```
TELEGRAM_BOT_TOKEN=<new-token>
ANTHROPIC_API_KEY=<your-anthropic-key>
TELEGRAM_BOT_SYSTEM_PROMPT=<optional>
TELEGRAM_BOT_WEBHOOK_SECRET=<generate: openssl rand -hex 32>
```

**3b. Register webhook and bot commands** (run from local machine — needs internet):
```bash
export TELEGRAM_BOT_TOKEN=<new-token>
export TELEGRAM_BOT_WEBHOOK_SECRET=<same-value-as-vercel>

# Register commands in Telegram UI (shows up in / picker)
node scripts/telegram/setup-bot-webhook.mjs init

# Register webhook URL (use your actual Vercel domain)
node scripts/telegram/setup-bot-webhook.mjs set https://<your-vercel-domain>/api/telegram-bot-webhook

# Verify it's registered
node scripts/telegram/setup-bot-webhook.mjs get
```

After this, Railway polling stops itself automatically (409 Conflict). Vercel handles everything.

---

## Environment variables

| Variable | Railway | Vercel | Purpose |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ required | ✅ required | Bot token from BotFather |
| `ANTHROPIC_API_KEY` | ✅ required | ✅ required | Calls Claude API |
| `TELEGRAM_BOT_SYSTEM_PROMPT` | optional | optional | Claude's personality/instructions |
| `TELEGRAM_BOT_WEBHOOK_SECRET` | not needed | ✅ required | Authenticates Telegram webhook calls |
| `TELEGRAM_BOT_ALERT_CHAT_IDS` | optional | not used | Push alerts from relay events |

---

## Key files

```
api/telegram-bot-webhook.js              — Vercel webhook handler (stateless, calls Claude)
scripts/ais-relay.cjs                    — Railway relay (search: "Telegram Bot — Claude AI bridge")
scripts/telegram/setup-bot-webhook.mjs  — CLI: init / set / get / delete
.env.example                             — all variables documented
```

## Bot
[@Hughpaytensmith_bot](https://t.me/Hughpaytensmith_bot)
