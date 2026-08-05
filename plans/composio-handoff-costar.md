# COSTAR — Composio Install & Account Connection (LOCAL EXECUTION)

> Handoff note: this file was authored in a Claude Code cloud session that could
> NOT run the task (sandbox egress policy blocked *.composio.dev). It is meant
> to be executed by Claude Code running locally on Hugh's MacBook. If you are
> reading this in the teleported session, execute it here.

## CONTEXT
I'm Hugh, operating across four domains: Hollow Bones Jewellery (Shopify,
Instagram), Blackbird Byron Bay (GM role, ops), InnerLoom (Kajabi, marketing),
and HAL (hospitality AI layer, co-built with James Hudson).

Machine: MacBook Air 2018, Intel i5 (x86_64 — NOT arm64), 8GB RAM, macOS, zsh.
CRITICAL SHELL CONSTRAINT: heredocs fail in this zsh. All file writes must use
sequential `echo >>` or `python3 -c "open(...).write(...)"`. Never use
`cat <<EOF`. This applies to EVERY file written in this session, including the
final deliverable.

I have three separate Google accounts (personal, HBJ, InnerLoom). Composio
supports multiple connected accounts per toolkit — all three must be connected
and labelled distinctly so tools can be routed per-account later.

### Prior attempt — carry this knowledge forward, do not re-litigate it
A previous cloud session failed at Phase 0: the sandbox egress policy blocked
ALL of *.composio.dev (CONNECT 403 at the gateway). Nothing was installed, no
accounts were touched. That failure was environment-specific and says nothing
about this Mac. Verified facts from that session, current as of 2026-08-05:
  - There is NO official Composio CLI package on npm (`@composio/cli` is 404;
    only SDK packages exist: @composio/core, @composio/client, etc.).
  - PyPI `composio` 0.18.1 is the SDK; `composio-core` is DEPRECATED. Neither
    is the CLI. The install script at https://composio.dev/install is the
    canonical CLI path.
  - Therefore: if the install script fails locally, diagnose the actual error —
    do not fall back to pip/npm packages assuming they're equivalent. They
    are not.

Composio CLI is in active development with no SLA. Command surface has churned.
Do NOT trust your training data for command syntax — verify against
`composio --help full` and https://docs.composio.dev/docs/cli before running
anything. If a documented command doesn't exist in the installed version, say
so and find the real one via --help. Never invent syntax.

## OBJECTIVE
Install the Composio CLI, authenticate, and connect my accounts in three
read-only-first phases, producing a written inventory of what connected and
what failed.

Phase 0 — Install and verify:
  curl -fsSL https://composio.dev/install | bash
  (Confirm the fetched binary is x86_64/universal, not arm64-only — this is an
  Intel Mac. If the script installs the wrong arch, the binary fails with
  "bad CPU type"; find the correct artifact rather than forcing Rosetta
  assumptions.)
  composio login        # opens browser — Hugh completes auth, then verify
  composio whoami
  composio --version
  Confirm the composio-cli Claude Code skill installed (it installs by default
  on login; manual fallback: composio --install-skill composio-cli claude).
  Then run `composio --help full` and report the ACTUAL available commands
  before proceeding. Everything in Phases 1–3 uses only commands confirmed to
  exist in this output.

Phase 1 — Catalogue audit (no connections yet):
  For each app below, confirm a toolkit exists and report its slug and whether
  auth is OAuth2 or API key. Use toolkit search/list commands as verified in
  Phase 0.
    Email/Docs: gmail (x3 accounts), googledrive, googlecalendar
    Comms: whatsapp, slack, telegram
    Social: instagram, facebook, linkedin, youtube
    Commerce: shopify
    Finance: xero
    Ops: notion, clickup, airtable, kajabi, stripe
    Dev: github
  Report anything with NO toolkit as a gap. Do not substitute or improvise.

Phase 2 — Connect, read-only, in tiers:
  Tier A (connect first, verify each before moving on): gmail x3,
  googlecalendar, googledrive, xero, shopify, github.
  For the three gmail accounts: connect sequentially, one OAuth flow at a
  time, and label each connected account distinctly (personal / hbj /
  innerloom) using whatever labelling mechanism the installed CLI actually
  supports. Tell Hugh which Google account to pick in the browser before each
  flow starts.
  Tier B: instagram, facebook, linkedin, notion, clickup, slack.
  Tier C: everything remaining from the Phase 1 audit.
  After each tier, verify with the connected-accounts list command and report
  status per account.

Phase 3 — Prove it works:
  Execute ONE read-only tool per connected toolkit as a smoke test
  (e.g. XERO_GET_ORGANISATION, GMAIL_FETCH_EMAILS with max_results 1).
  For gmail, run the smoke test against EACH of the three connected accounts
  to prove routing by label works. Inspect the input schema first via the
  schema flag. Report pass/fail per tool.

## STYLE
Terminal-first. Show the exact command, then its actual output. No pseudo-code,
no "you would run". Verify before asserting.

## TONE
Blunt, engineering-grade. Flag uncertainty explicitly. If a documented command
doesn't exist in the installed version, say so and find the real one — do not
invent syntax.

## AUDIENCE
Technical operator. Skip explanations of OAuth. Assume I understand scopes,
tokens, and API rate limits.

## RESPONSE
Hard gates — stop and wait for Hugh's explicit go-ahead at each:
  GATE 0: if Phase 0 install or login fails, stop and report — do not try
          alternative install paths without sign-off (see prior-attempt notes:
          the pip/npm packages are NOT the CLI).
  GATE 1: after Phase 1, before any account is connected. Present the audit
          table (app / slug exists / auth type / scopes requested).
  GATE 2: before connecting Tier B or C.
  GATE 3: before requesting ANY write scope on ANY toolkit. Read-only default,
          no exceptions.

Deliverable at the end — write composio-inventory.md to:
  [FILL IN: exact vault subfolder path, e.g. ~/Vault/Systems/Composio/]
Never write to vault root. If the folder doesn't exist, ask before creating
it. If the FILL IN above has not been replaced by the time the deliverable is
due, ASK FOR THE PATH FIRST — do not guess, do not default to cwd, and do not
write it into this repository.

File: composio-inventory.md — one row per toolkit: slug, connected account ID,
account label, auth type, scopes granted, smoke test result, date.
Write it using echo >> or python3, not a heredoc.

Do not connect anything Hugh didn't list. Do not enable triggers or webhooks in
this session. Do not store secrets in any file you write — the inventory
records IDs and labels, never tokens.
