import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countLines, resolveMinLines, buildReason } from '../adapters/claude-code/hooks/src/shared.ts';

test('countLines counts newline characters like `wc -l`', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adapter-hooks-'));
  const file = join(dir, 'sample.txt');
  writeFileSync(file, 'a\nb\nc\n');
  assert.equal(countLines(file), 3);
  rmSync(dir, { recursive: true, force: true });
});

test('countLines returns undefined for a missing file', () => {
  assert.equal(countLines('/nonexistent/path/does-not-exist.txt'), undefined);
});

test('resolveMinLines defaults to 350 with no env var set', () => {
  assert.equal(resolveMinLines({}), 350);
});

test('resolveMinLines reads CONTEXT_ROUTER_MIN_LINES from the given env', () => {
  assert.equal(resolveMinLines({ CONTEXT_ROUTER_MIN_LINES: '100' }), 100);
});

test('resolveMinLines falls back to 350 on a non-numeric value', () => {
  assert.equal(resolveMinLines({ CONTEXT_ROUTER_MIN_LINES: 'not-a-number' }), 350);
});

test('buildReason names the line count, threshold, and the tool to call', () => {
  const reason = buildReason(500, 350);
  assert.match(reason, /500 lines/);
  assert.match(reason, /threshold: 350/);
  assert.match(reason, /bulk_read_files/);
});

import { decideFileSizeRead } from '../adapters/claude-code/hooks/src/checkFileSize.ts';

test('decideFileSizeRead allows a targeted read with offset set', () => {
  const result = decideFileSizeRead({ file_path: '/some/file.ts', offset: 10 }, 350, () => 9999);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideFileSizeRead allows a targeted read with limit set', () => {
  const result = decideFileSizeRead({ file_path: '/some/file.ts', limit: 50 }, 350, () => 9999);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideFileSizeRead allows when the file path is missing from tool_input', () => {
  const result = decideFileSizeRead({}, 350, () => 9999);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideFileSizeRead allows when the line-count lookup returns undefined', () => {
  const result = decideFileSizeRead({ file_path: '/missing.ts' }, 350, () => undefined);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideFileSizeRead allows exactly at the threshold (350 lines)', () => {
  const result = decideFileSizeRead({ file_path: '/f.ts' }, 350, () => 350);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideFileSizeRead blocks one line over the threshold', () => {
  const result = decideFileSizeRead({ file_path: '/f.ts' }, 350, () => 351);
  assert.ok(result.decision === 'block');
  assert.match(result.reason, /351 lines/);
});

test('decideFileSizeRead respects a custom threshold', () => {
  const result = decideFileSizeRead({ file_path: '/f.ts' }, 100, () => 150);
  assert.equal(result.decision, 'block');
});

import { decideBashRead } from '../adapters/claude-code/hooks/src/checkBashRead.ts';

test('decideBashRead allows a piped command regardless of size', () => {
  const result = decideBashRead({ command: 'cat huge.txt | grep foo' }, 350, () => 9999);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideBashRead allows a redirected command regardless of size', () => {
  const result = decideBashRead({ command: 'cat huge.txt > copy.txt' }, 350, () => 9999);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideBashRead allows a small file via cat', () => {
  const result = decideBashRead({ command: 'cat small.txt' }, 350, () => 100);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideBashRead blocks a plain cat over the threshold', () => {
  const result = decideBashRead({ command: 'cat large.txt' }, 350, () => 800);
  assert.equal(result.decision, 'block');
});

test('decideBashRead blocks head over the threshold', () => {
  const result = decideBashRead({ command: 'head large.txt' }, 350, () => 800);
  assert.equal(result.decision, 'block');
});

test('decideBashRead strips a bare flag like `cat -n` and still blocks', () => {
  const result = decideBashRead({ command: 'cat -n large.txt' }, 350, () => 800);
  assert.equal(result.decision, 'block');
});

test('decideBashRead strips a numeric flag like `head -100` and still blocks', () => {
  const result = decideBashRead({ command: 'head -100 large.txt' }, 350, () => 800);
  assert.equal(result.decision, 'block');
});

test('decideBashRead blocks tail/less/more over the threshold', () => {
  for (const command of ['tail large.txt', 'less large.txt', 'more large.txt']) {
    const result = decideBashRead({ command }, 350, () => 800);
    assert.equal(result.decision, 'block', `expected block for: ${command}`);
  }
});

test('decideBashRead allows a command it does not recognize as a read', () => {
  const result = decideBashRead({ command: 'grep foo large.txt' }, 350, () => 800);
  assert.deepEqual(result, { decision: 'allow' });
});

test('decideBashRead allows an empty command', () => {
  const result = decideBashRead({}, 350, () => 800);
  assert.deepEqual(result, { decision: 'allow' });
});
