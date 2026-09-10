import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { HookDecision } from './shared.ts';
import { buildReason, countLines, resolveMinLines, serializeHookOutput } from './shared.ts';

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(readStdin());
  } catch {
    return;
  }
  const toolInput = (parsed as { tool_input?: { command?: string } }).tool_input ?? {};
  const result = decideBashRead(toolInput, resolveMinLines(), countLines);
  const output = serializeHookOutput(result);
  if (output) process.stdout.write(`${output}\n`);
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  // import.meta.url is realpath-resolved (and percent-encoded) by Node for the entry
  // script, so argv[1] must be resolved the same way or this guard silently fails
  // whenever the install path contains a symlink (e.g. macOS /tmp -> /private/tmp)
  // or, without pathToFileURL's encoding, a space.
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isMainModule()) {
  runCli();
}
