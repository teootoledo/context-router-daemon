// Pure measurement helpers for the bulk-read benchmark. Kept separate from the
// runner so they can be unit-tested without a live backend or an API key.

// ponytail: chars/4 is a crude token estimate, but both payloads are measured the
// same way, so the savings RATIO — the number this benchmark exists to report — is
// robust to the error. Swap in a real tokenizer only if absolute counts must be exact.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type BenchResult = {
  name: string;
  baselineTokens: number;
  summaryTokens: number;
  /** Fraction of frontier-model tokens avoided. Negative means routing made it worse. */
  savings: number;
  ms: number;
};

export function measure(opts: {
  name: string;
  baselineText: string;
  summaryText: string;
  ms: number;
}): BenchResult {
  const baselineTokens = estimateTokens(opts.baselineText);
  const summaryTokens = estimateTokens(opts.summaryText);

  return {
    name: opts.name,
    baselineTokens,
    summaryTokens,
    // An empty baseline has nothing to save, and dividing by it would be NaN.
    savings: baselineTokens === 0 ? 0 : 1 - summaryTokens / baselineTokens,
    ms: opts.ms,
  };
}

export function formatTable(results: BenchResult[]): string {
  const header = ['case', 'raw tokens', 'summary', 'savings', 'latency'];
  const rows = results.map(r => [
    r.name,
    String(r.baselineTokens),
    String(r.summaryTokens),
    `${(r.savings * 100).toFixed(1)}%`,
    `${(r.ms / 1000).toFixed(1)}s`,
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map(row => row[i].length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');

  return [line(header), widths.map(w => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}
