import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BulkReadRequestSchema, BulkReadResponseSchema } from '@context-router/contract';

export async function readAndSummarize(
  input: { paths: string[]; query: string },
  opts: { backstageUrl: string },
): Promise<string> {
  const files = await Promise.all(
    input.paths.map(async (p) => ({ path: p, content: await readFile(p, 'utf8') })),
  );

  const request = BulkReadRequestSchema.parse({ query: input.query, files });

  // Join relative to a trailing-slash base so a Backstage instance hosted at a
  // sub-path (e.g. https://company.com/backstage) isn't discarded: resolving an
  // absolute '/api/...' path against a base always replaces the base's own path.
  const base = opts.backstageUrl.endsWith('/') ? opts.backstageUrl : `${opts.backstageUrl}/`;
  const url = new URL('api/context-router/modes/bulk-reader', base);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    // Slightly longer than the backend's own Gemini timeout, so a stalled backend
    // produces the backend's real error instead of a client-side abort here.
    signal: AbortSignal.timeout(150_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `context-router backend returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }

  const response = BulkReadResponseSchema.parse(await res.json());
  return response.summary;
}

export function registerBulkReadFiles(server: McpServer, opts: { backstageUrl: string }): void {
  server.registerTool(
    'bulk_read_files',
    {
      description:
        'Reads one or more files and answers a query about them via a cheap worker model, without pulling raw file contents into this context window.',
      inputSchema: {
        paths: z.array(z.string()).min(1),
        query: z.string().min(1),
      },
    },
    async ({ paths, query }) => {
      const summary = await readAndSummarize({ paths, query }, opts);
      return { content: [{ type: 'text', text: summary }] };
    },
  );
}
