# context-router Claude Code adapter

A Claude Code plugin that blocks native large file reads (`Read` over ~350 lines, or `cat`/`head`/`tail`/`less`/`more` on a large file via `Bash`) and redirects the agent to [`bulk_read_files`](../../src/tools/bulkReadFiles.ts) — the context-router-daemon's own MCP tool — so raw file content never enters the calling agent's context window.

## What it does

- `hooks/checkFileSize.js` — a `PreToolUse` hook on `Read`. Allows targeted reads (an `offset`/`limit` already set) and anything at or under the threshold; blocks everything else with a reason telling the agent to call `bulk_read_files` instead.
- `hooks/checkBashRead.js` — the same check for `cat`/`head`/`tail`/`less`/`more` invoked via `Bash`, so the Read hook can't be trivially routed around. Piped and redirected commands are always allowed through — they're already targeted/filtered reads.
- `skills/bulk-reader/SKILL.md` — teaches the agent to reach for `bulk_read_files` proactively (large files, 3+ files, big diffs), and to verify exact values before using them in an edit.

## Threshold

Default: 350 lines. Override with the `CONTEXT_ROUTER_MIN_LINES` environment variable.

## Install

This plugin isn't listed on a marketplace — install it from a local checkout of this repo:

```bash
git clone https://github.com/teootoledo/context-router-daemon.git
```

Then, in Claude Code, add it as a local plugin directory pointing at `context-router-daemon/adapters/claude-code` (see Claude Code's current plugin-directory documentation for the exact mechanism).

The daemon itself must also be configured and running (see the [main README](../../README.md)) — this plugin only redirects to `bulk_read_files`; it doesn't replace the daemon.

## Rebuilding the hooks

`hooks/checkFileSize.js` and `hooks/checkBashRead.js` are built from `hooks/src/*.ts` and committed directly — there's no build step at install time. After changing the source, rebuild and commit the output:

```bash
npm run build:hooks
```

## Manual smoke test

Automated tests cover the hook decision logic (`../../test/adapterHooks.test.ts`); confirming the plugin actually redirects a real Claude Code session is a manual step:

1. Install the plugin locally (see above) and make sure context-router-daemon is running and configured.
2. In a Claude Code session with the plugin active, ask a question that requires reading a file over 350 lines.
3. Confirm: the native `Read` (or `cat`/`head`/`tail`) is blocked, the agent sees the redirect reason, and it calls `bulk_read_files` instead of reading the file directly.
