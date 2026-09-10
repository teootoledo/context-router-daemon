import { readFileSync } from 'node:fs';

export type HookDecision = { decision: 'allow' } | { decision: 'block'; reason: string };

export function countLines(path: string): number | undefined {
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
  return (content.match(/\n/g) ?? []).length;
}

export function resolveMinLines(env: Record<string, string | undefined> = process.env): number {
  const raw = env.CONTEXT_ROUTER_MIN_LINES;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 350;
}

export function buildReason(lines: number, minLines: number): string {
  return `File is ${lines} lines (threshold: ${minLines}). Use the bulk_read_files MCP tool instead of reading it directly — call it with this file's path and a question about what you need from it. If you need exact line numbers or values for an edit, re-read with an offset/limit for just that section.`;
}
