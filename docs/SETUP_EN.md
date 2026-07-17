# Concise Setup Guide

This guide sets up Codex Telegram Watch Bridge on Windows. The bridge runs locally, sends Codex completion notifications to a private Telegram bot, and lets you reply from Telegram or Apple Watch Dictation to continue the same Codex session.

## Requirements

- Windows 11
- Node.js `22.5.0` or newer
- Codex Desktop signed in
- Codex CLI signed in
- Telegram on iPhone, and optionally Apple Watch
- One private Telegram bot

## 1. Install Node.js

Open PowerShell and run:

```powershell
winget install OpenJS.NodeJS.LTS
```

Restart PowerShell, then verify:

```powershell
node --version
npm.cmd --version
```

## 2. Install and Sign In to Codex CLI

```powershell
npm.cmd install --global @openai/codex@latest
codex.cmd --version
codex.cmd login
codex.cmd login status
```

`codex.cmd login status` must show that you are signed in. The bridge uses this CLI login; it does not need an OpenAI API key.

## 3. Create a Private Telegram Bot

1. Open Telegram and chat with `@BotFather`.
2. Send `/newbot`.
3. Choose a bot name and a username ending in `bot`.
4. Save the bot token securely. Treat it like a password.
5. Open a private chat with your new bot and send `/start`.

Do not commit the token, paste it into issues, or share it in screenshots.

## 4. Install the Project

From the project folder:

```powershell
Set-Location 'D:\Nukker\codex-telegram-watch-bridge'
npm.cmd install
npm.cmd run build
```

Optional full verification:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## 5. Run Interactive Setup

Make sure you already sent `/start` to the Telegram bot, then run:

```powershell
npm.cmd run setup
```

The setup command will:

- ask for the Telegram bot token
- verify the bot with Telegram
- detect your Telegram user ID and chat ID
- generate a bridge secret
- write the runtime config to `%LOCALAPPDATA%\CodexTelegramBridge\.env`

Confirm the detected Telegram account before accepting.

## 6. Set the Codex Executable Path

Find the real `codex.exe` path:

```powershell
$CodexRoot = Join-Path (npm.cmd root --global) '@openai\codex'
$CodexExe = Get-ChildItem -Recurse -Filter codex.exe -LiteralPath $CodexRoot | Select-Object -First 1 -ExpandProperty FullName
$CodexExe
```

Open the runtime config:

```powershell
notepad "$env:LOCALAPPDATA\CodexTelegramBridge\.env"
```

Set `CODEX_BIN` to the full path returned above, for example:

```dotenv
CODEX_BIN=C:\Users\<you>\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe
```

Save and close the file.

## 7. Check the Installation

Run:

```powershell
npm.cmd run doctor
```

Before the bridge is running, `local bridge` and `Stop hook` may fail. Configuration, Telegram token, runtime directory, and Codex executable should pass.

## 8. Start the Bridge

Run:

```powershell
npm.cmd run start
```

In Telegram, send:

```text
/ping
```

The bot should reply. Keep this PowerShell window open while testing.

## 9. Install the Codex Stop Hook

Build first, then install the user-level hook:

```powershell
npm.cmd run build
npm.cmd run hook:install
npm.cmd run hook:status
```

In Codex, open `/hooks`, review the hook, and trust it. After a Codex task finishes, the bridge should send a Telegram notification.

## 10. Optional: Start Automatically on Login

After manual testing works:

```powershell
npm.cmd run startup:install
npm.cmd run startup:status
```

This creates a hidden per-user Windows Scheduled Task. Stop any visible manual bridge before relying on the scheduled one, because only one process can use the bridge port.

## Useful Telegram Commands

- `/ping` checks that the bot is alive.
- `/sessions` lists known Codex sessions.
- `/use 1` selects a session from the list.
- `/clear` forgets the current selected session.
- `/clearall` clears saved session mappings.
- `/jobs` or `/history` shows recent bridge jobs.

Send normal Telegram text after selecting a session. For Apple Watch, use Dictation as text, not a voice note.

## Quick Troubleshooting

Run these checks first:

```powershell
node --version
npm.cmd --version
codex.cmd --version
codex.cmd login status
npm.cmd run doctor
npm.cmd run hook:status
npm.cmd run startup:status
```

If `Codex executable` fails, update `CODEX_BIN` in `%LOCALAPPDATA%\CodexTelegramBridge\.env` to the full `codex.exe` path.

If Telegram fails, verify internet access, send `/start` to the bot again, and rerun `npm.cmd run setup` if the token changed.

If port `47831` is already in use but `/ping` works, the bridge is probably already running. If `/ping` does not work, stop the stale bridge process or restart Windows.

## Uninstall

Stop the bridge, then run:

```powershell
npm.cmd run startup:uninstall
npm.cmd run hook:uninstall -- --dry-run
npm.cmd run hook:uninstall
```

If you are done permanently, revoke the Telegram bot token with `@BotFather` and remove `%LOCALAPPDATA%\CodexTelegramBridge`.
