import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const checkFileSizeJs = join(here, '..', 'adapters', 'claude-code', 'hooks', 'checkFileSize.js');
const checkBashReadJs = join(here, '..', 'adapters', 'claude-code', 'hooks', 'checkBashRead.js');

function runHook(hookPath: string, toolInput: Record<string, unknown>): string {
  return execFileSync('node', [hookPath], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: 'utf8',
  });
}

test('checkFileSize.js allows a small file with empty stdout and exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-cli-'));
  const file = join(dir, 'small.txt');
  writeFileSync(file, 'a\nb\n');
  const stdout = runHook(checkFileSizeJs, { file_path: file });
  assert.equal(stdout, '');
  rmSync(dir, { recursive: true, force: true });
});

test('checkFileSize.js blocks a large file with the correct hookSpecificOutput JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-cli-'));
  const file = join(dir, 'large.txt');
  writeFileSync(file, 'x\n'.repeat(400));
  const stdout = runHook(checkFileSizeJs, { file_path: file });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /400 lines/);
  rmSync(dir, { recursive: true, force: true });
});

test('checkFileSize.js fails open (empty stdout, exit 0) on malformed stdin', () => {
  const stdout = execFileSync('node', [checkFileSizeJs], { input: 'not json', encoding: 'utf8' });
  assert.equal(stdout, '');
});

test('checkBashRead.js blocks a large file read via cat', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-cli-'));
  const file = join(dir, 'large.txt');
  writeFileSync(file, 'x\n'.repeat(400));
  const stdout = runHook(checkBashReadJs, { command: `cat ${file}` });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  rmSync(dir, { recursive: true, force: true });
});

test('checkFileSize.js still enforces correctly when its own path contains a space (regression: import.meta.url guard)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter cli with space '));
  const copiedHook = join(dir, 'checkFileSize.js');
  copyFileSync(checkFileSizeJs, copiedHook);
  chmodSync(copiedHook, 0o755);

  const file = join(dir, 'large.txt');
  writeFileSync(file, 'x\n'.repeat(400));

  const stdout = runHook(copiedHook, { file_path: file });
  const parsed = JSON.parse(stdout);
  assert.equal(
    parsed.hookSpecificOutput.permissionDecision,
    'deny',
    'expected a real block decision, not a silent allow from a broken path guard',
  );
  rmSync(dir, { recursive: true, force: true });
});
