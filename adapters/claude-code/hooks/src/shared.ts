import { statSync, openSync, closeSync, readSync } from 'node:fs';

export type HookDecision = { decision: 'allow' } | { decision: 'block'; reason: string };

export function countLines(path: string): number | undefined {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return undefined;
  }
  if (!stat.isFile()) return undefined;

  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    let count = 0;
    let bytesRead: number;
    while ((bytesRead = readSync(fd, buf, 0, buf.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 0x0a) count++;
      }
    }
    return count;
  } finally {
    closeSync(fd);
  }
}

export function resolveMinLines(env: Record<string, string | undefined> = process.env): number {
  const raw = env.CONTEXT_ROUTER_MIN_LINES;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 350;
}

export function buildReason(lines: number, minLines: number): string {
  return `Blocked by the context-router plugin: file is ${lines} lines (threshold: ${minLines}). Use the bulk_read_files tool (an MCP tool provided by context-router-daemon) instead of reading it directly — call it with this file's path and a question about what you need from it. If you need exact line numbers or values for an edit, re-read with an offset/limit for just that section.`;
}

export function serializeHookOutput(decision: HookDecision): string {
  if (decision.decision === 'allow') return '';
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: decision.reason,
    },
  });
}
