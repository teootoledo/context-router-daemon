#!/usr/bin/env node

// adapters/claude-code/hooks/src/checkBashRead.ts
import { readFileSync as readFileSync2 } from "node:fs";

// adapters/claude-code/hooks/src/shared.ts
import { readFileSync } from "node:fs";
function countLines(path) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return void 0;
  }
  return (content.match(/\n/g) ?? []).length;
}
function resolveMinLines(env = process.env) {
  const raw = env.CONTEXT_ROUTER_MIN_LINES;
  const parsed = raw !== void 0 ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 350;
}
function buildReason(lines, minLines) {
  return `File is ${lines} lines (threshold: ${minLines}). Use the bulk_read_files MCP tool instead of reading it directly \u2014 call it with this file's path and a question about what you need from it. If you need exact line numbers or values for an edit, re-read with an offset/limit for just that section.`;
}

// adapters/claude-code/hooks/src/checkBashRead.ts
function decideBashRead(input, minLines, lineCount) {
  const command = input.command?.trim();
  if (!command) return { decision: "allow" };
  if (command.includes("|") || command.includes(">")) return { decision: "allow" };
  const match = command.match(/^(cat|head|tail|less|more)\s+(.*)$/);
  if (!match) return { decision: "allow" };
  const args = match[2].split(/\s+/).filter(Boolean);
  let filePath;
  for (const arg of args) {
    if (arg.startsWith("-")) continue;
    filePath = arg.replace(/^['"]|['"]$/g, "");
    break;
  }
  if (!filePath) return { decision: "allow" };
  const lines = lineCount(filePath);
  if (lines === void 0 || lines <= minLines) return { decision: "allow" };
  return { decision: "block", reason: buildReason(lines, minLines) };
}
function readStdin() {
  return readFileSync2(0, "utf8");
}
function runCli() {
  const parsed = JSON.parse(readStdin());
  const toolInput = parsed.tool_input ?? {};
  const result = decideBashRead(toolInput, resolveMinLines(), countLines);
  process.stdout.write(`${JSON.stringify(result)}
`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
export {
  decideBashRead
};
