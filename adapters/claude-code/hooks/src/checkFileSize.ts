import { readFileSync } from 'node:fs';
import type { HookDecision } from './shared.ts';
import { buildReason, countLines, resolveMinLines } from './shared.ts';

export function decideFileSizeRead(
  input: { file_path?: string; offset?: unknown; limit?: unknown },
  minLines: number,
  lineCount: (path: string) => number | undefined,
): HookDecision {
  if (input.offset !== undefined || input.limit !== undefined) return { decision: 'allow' };
  if (!input.file_path) return { decision: 'allow' };
  const lines = lineCount(input.file_path);
  if (lines === undefined || lines <= minLines) return { decision: 'allow' };
  return { decision: 'block', reason: buildReason(lines, minLines) };
}

function readStdin(): string {
  return readFileSync(0, 'utf8');
}

function runCli(): void {
  const parsed = JSON.parse(readStdin());
  const toolInput = parsed.tool_input ?? {};
  const result = decideFileSizeRead(toolInput, resolveMinLines(), countLines);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
