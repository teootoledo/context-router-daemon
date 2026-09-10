import { readFileSync } from 'node:fs';
import type { HookDecision } from './shared.ts';
import { buildReason, countLines, resolveMinLines } from './shared.ts';

export function decideBashRead(
  input: { command?: string },
  minLines: number,
  lineCount: (path: string) => number | undefined,
): HookDecision {
  const command = input.command?.trim();
  if (!command) return { decision: 'allow' };
  if (command.includes('|') || command.includes('>')) return { decision: 'allow' };

  const match = command.match(/^(cat|head|tail|less|more)\s+(.*)$/);
  if (!match) return { decision: 'allow' };

  const args = match[2].split(/\s+/).filter(Boolean);
  let filePath: string | undefined;
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    filePath = arg.replace(/^['"]|['"]$/g, '');
    break;
  }
  if (!filePath) return { decision: 'allow' };

  const lines = lineCount(filePath);
  if (lines === undefined || lines <= minLines) return { decision: 'allow' };
  return { decision: 'block', reason: buildReason(lines, minLines) };
}

function readStdin(): string {
  return readFileSync(0, 'utf8');
}

function runCli(): void {
  const parsed = JSON.parse(readStdin());
  const toolInput = parsed.tool_input ?? {};
  const result = decideBashRead(toolInput, resolveMinLines(), countLines);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
