import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, formatTable, measure } from '../bench/measure.ts';

test('estimateTokens scales with text length', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('measure reports the fraction of tokens avoided', () => {
  const result = measure({
    name: 'case',
    baselineText: 'x'.repeat(4000), // 1000 tokens
    summaryText: 'y'.repeat(400), // 100 tokens
    ms: 1500,
  });

  assert.equal(result.baselineTokens, 1000);
  assert.equal(result.summaryTokens, 100);
  assert.equal(result.savings, 0.9);
  assert.equal(result.ms, 1500);
});

test('measure reports negative savings when the summary is longer than the input', () => {
  const result = measure({
    name: 'worse',
    baselineText: 'x'.repeat(400),
    summaryText: 'y'.repeat(800),
    ms: 10,
  });

  // Not clamped to zero: routing that costs more than it saves must be visible.
  assert.ok(result.savings < 0, `expected negative savings, got ${result.savings}`);
});

test('measure does not divide by zero on an empty baseline', () => {
  const result = measure({ name: 'empty', baselineText: '', summaryText: '', ms: 0 });
  assert.equal(result.savings, 0);
});

test('formatTable renders a row per case with a percentage', () => {
  const table = formatTable([
    measure({ name: 'alpha', baselineText: 'x'.repeat(4000), summaryText: 'y'.repeat(400), ms: 2000 }),
  ]);

  assert.match(table, /case/);
  assert.match(table, /alpha/);
  assert.match(table, /90\.0%/);
  assert.match(table, /2\.0s/);
});
