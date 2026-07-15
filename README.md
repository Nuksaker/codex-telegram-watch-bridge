# Codex Telegram Watch Bridge

A Windows-first local bridge that sends private Codex `Stop` notifications to Telegram and routes a Telegram text reply—including text produced by Apple Watch Dictation—back to the exact saved Codex session.

## What is implemented

- Loopback-only Fastify API authenticated with a generated shared secret.
- Fast Stop-hook adapter with a 1.5 second default timeout and bounded atomic spool.
- Telegram Bot API long polling through grammY; both private `user_id` and `chat_id` are required.
- SQLite event deduplication and Telegram message-to-Codex-session mappings.
- Safe `codex exec resume <SESSION_ID> <PROMPT>` spawning with `shell: false` and discrete arguments.
- Explicit-reply-first routing, safe ambiguity handling, per-session lock, and global queue limit.
- Watch-friendly job receipts, running/completed/failed updates, and `/jobs` history with redacted prompt previews.
- Startup recovery that marks abandoned queued/running jobs as interrupted instead of leaving stale status behind.
- Setup, doctor, reversible user hook installer, and optional Windows Scheduled Task commands.
- Offline unit/integration tests with fake Telegram and fake Codex implementations.

Persistence uses Node's built-in `node:sqlite` API instead of a native addon. This keeps Windows installation simple and avoids post-install compilation; some supported Node releases may still print an experimental API warning even though the required calls are covered by the test suite.

The current official Codex documentation confirms the Stop-hook JSON stdin shape, user-level `~/.codex/hooks.json`, hook review/trust through `/hooks`, and the `codex exec resume <SESSION_ID>` command. Transcript parsing remains best-effort because Codex documents that transcript format as unstable.

## Quick verification

Requires Node.js 22.5 or later (Node 22+ is recommended by the product PRD).

```powershell
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Then follow [docs/SETUP_TH.md](docs/SETUP_TH.md). Never commit the runtime `.env`, Telegram bot token, database, spool, or logs.

## Architecture

```mermaid
flowchart TD
  A["Codex Stop hook"] -->|"loopback + secret"| B["Local bridge"]
  A -->|"bridge offline"| C["Bounded spool"]
  C --> B
  B --> D["SQLite mappings"]
  B <-->|"long polling"| E["Private Telegram bot"]
  E --> F["iPhone / Apple Watch"]
  B -->|"argument array"| G["codex exec resume"]
```

## Security model

- No public inbound port and no Telegram webhook.
- The HTTP service rejects non-loopback binding at configuration validation.
- Telegram updates must match both configured numeric IDs.
- Telegram text is never interpreted as a command line; it is one Codex prompt argument.
- Codex authentication, sandboxing, rules, and approvals are inherited. This project includes no bypass or auto-approval flags.
- Full raw prompts are not stored. Job history keeps a SHA-256 hash plus a bounded, whitespace-normalized preview after known secret patterns are replaced with `[REDACTED]`.
- Secrets and prompt fields are redacted from structured logs.

## Important limitations

- No real Telegram, iPhone, Apple Watch, or Codex account is used by automated tests. Complete the real-device checklist before calling the installation end-to-end verified.
- Work resumed externally updates the saved Codex session, but an already-open Codex Desktop view may not live-refresh on every app version. Reopen the task if needed.
- Voice-note audio transcription is out of scope. Use Apple Watch Dictation so Telegram sends normal text.
- Approval-required Codex actions can still require an official Codex surface; the bridge never bypasses approvals.
- Global user hooks can notify for every project. Project allow/deny filtering can be added after the first controlled device test; per-session mute is included now.

## Apple Watch command flow

When there is more than one recent Codex session, send `/sessions`, then `/use 1` (or another listed number). Send the command as normal Telegram text after that. The bridge replies with:

1. `📝` a numbered receipt containing the project, short session ID, and redacted command preview;
2. `▶️` confirmation that Codex has started;
3. `✅` success or `❌` failure, followed by the normal Stop-hook summary when available.

Use `/jobs` or `/history` to see the five most recent commands and their state. If Windows or the bridge restarts during a command, the abandoned job is shown as interrupted and the bot asks you to send it again.
