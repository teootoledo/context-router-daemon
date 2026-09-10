import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { HookDecision } from './shared.ts';
import { buildReason, countLines, resolveMinLines, serializeHookOutput } from './shared.ts';

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(readStdin());
  } catch {
    return;
  }
  const toolInput =
    (parsed as { tool_input?: { file_path?: string; offset?: unknown; limit?: unknown } }).tool_input ?? {};
  const result = decideFileSizeRead(toolInput, resolveMinLines(), countLines);
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
