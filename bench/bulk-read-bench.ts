// Measures what bulk_read_files actually saves: the frontier model would have
// ingested the raw file contents, but only ingests the returned summary. Run it
// against a live backend with a real Gemini key — this is the real thing, not a mock.
//
//   BACKSTAGE_URL=http://127.0.0.1:<port> npm run bench
//
// Exits non-zero if any case saves less than BENCH_MIN_SAVINGS (default 0.7), so a
// prompt that regresses into chattiness fails loudly instead of quietly costing money.

import { readFile } from 'node:fs/promises';
import { resolveBackstageUrl } from '../src/config.ts';
import { readAndSummarize } from '../src/tools/bulkReadFiles.ts';
import { formatTable, measure, type BenchResult } from './measure.ts';

const MIN_SAVINGS = Number(process.env.BENCH_MIN_SAVINGS ?? '0.7');

// Real files, not synthetic fixtures — the point is a number that means something.
// The spec and plan cases both contain a literal </file>, which also exercises the
// backend's XML escaping on the way through.
const CASES = [
  {
    name: 'daemon source (4 files)',
    paths: [
      'src/index.ts',
      'src/server.ts',
      'src/config.ts',
      'src/tools/bulkReadFiles.ts',
    ],
    query: 'Which file defines each exported function, and what does each one do?',
  },
  {
    name: 'spec + glossary',
    paths: ['../backstage-context-router-spec.md', '../CONTEXT.md'],
    query: 'Which worker model does the spec route work to, and what terms does the glossary define?',
  },
  {
    name: 'implementation plan (large doc)',
    paths: ['../docs/superpowers/plans/2026-09-08-bulk-reader-vertical-slice.md'],
    query: 'List each task and what it delivers.',
  },
];

const backstageUrl = resolveBackstageUrl();
const results: BenchResult[] = [];

for (const testCase of CASES) {
  const contents = await Promise.all(testCase.paths.map(p => readFile(p, 'utf8')));
  const started = Date.now();
  const summary = await readAndSummarize(
    { paths: testCase.paths, query: testCase.query },
    { backstageUrl },
  );

  results.push(
    measure({
      name: testCase.name,
      baselineText: contents.join('\n'),
      summaryText: summary,
      ms: Date.now() - started,
    }),
  );
}

console.log(formatTable(results));

const totalBaseline = results.reduce((sum, r) => sum + r.baselineTokens, 0);
const totalSummary = results.reduce((sum, r) => sum + r.summaryTokens, 0);
console.log(
  `\noverall: ${((1 - totalSummary / totalBaseline) * 100).toFixed(1)}% of frontier tokens avoided ` +
    `(${totalBaseline} -> ${totalSummary})`,
);

const belowFloor = results.filter(r => r.savings < MIN_SAVINGS);
if (belowFloor.length > 0) {
  console.error(
    `\nFAIL: ${belowFloor.length} case(s) under the ${(MIN_SAVINGS * 100).toFixed(0)}% floor: ` +
      belowFloor.map(r => `${r.name} (${(r.savings * 100).toFixed(1)}%)`).join(', '),
  );
  process.exit(1);
}
