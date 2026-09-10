#!/usr/bin/env node

// adapters/claude-code/hooks/src/checkBashRead.ts
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

// adapters/claude-code/hooks/src/shared.ts
import { statSync, openSync, closeSync, readSync } from "node:fs";
function countLines(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return void 0;
  }
  if (!stat.isFile()) return void 0;
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    let count = 0;
    let bytesRead;
    while ((bytesRead = readSync(fd, buf, 0, buf.length, null)) > 0) {
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 10) count++;
      }
    }
    return count;
  } finally {
    closeSync(fd);
  }
}
function resolveMinLines(env = process.env) {
  const raw = env.CONTEXT_ROUTER_MIN_LINES;
  const parsed = raw !== void 0 ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 350;
}
function buildReason(lines, minLines) {
  return `Blocked by the context-router plugin: file is ${lines} lines (threshold: ${minLines}). Use the bulk_read_files tool (an MCP tool provided by context-router-daemon) instead of reading it directly \u2014 call it with this file's path and a question about what you need from it. If you need exact line numbers or values for an edit, re-read with an offset/limit for just that section.`;
}
function serializeHookOutput(decision) {
  if (decision.decision === "allow") return "";
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: decision.reason
    }
  });
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
  return readFileSync(0, "utf8");
}
function runCli() {
  let parsed;
  try {
    parsed = JSON.parse(readStdin());
  } catch {
    return;
  }
  const toolInput = parsed.tool_input ?? {};
  const result = decideBashRead(toolInput, resolveMinLines(), countLines);
  const output = serializeHookOutput(result);
  if (output) process.stdout.write(`${output}
`);
}
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}
if (isMainModule()) {
  runCli();
}
export {
  decideBashRead
};
