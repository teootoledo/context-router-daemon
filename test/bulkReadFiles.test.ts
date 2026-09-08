import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAndSummarize } from '../src/tools/bulkReadFiles.ts';

test('readAndSummarize sends file content (not paths alone) and returns the backend summary', async (t) => {
  let receivedBody: any;
  const backend = createHttpServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      receivedBody = JSON.parse(raw);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ summary: '- widget.ts: exports renderWidget()' }));
    });
  });
  await new Promise<void>((resolve) => backend.listen(0, resolve));
  const port = (backend.address() as any).port;
  t.after(() => backend.close());

  const dir = await mkdtemp(path.join(tmpdir(), 'bulk-read-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'widget.ts');
  await writeFile(filePath, 'export function renderWidget() {}');

  const result = await readAndSummarize(
    { paths: [filePath], query: 'what does this file export?' },
    { backstageUrl: `http://127.0.0.1:${port}` },
  );

  assert.equal(result, '- widget.ts: exports renderWidget()');
  assert.equal(receivedBody.query, 'what does this file export?');
  assert.equal(receivedBody.files[0].path, filePath);
  assert.equal(receivedBody.files[0].content, 'export function renderWidget() {}');
});

test('readAndSummarize rejects when the backend is unreachable', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bulk-read-unreachable-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'widget.ts');
  await writeFile(filePath, 'export function renderWidget() {}');

  // Port 1 is reserved and never listening — the file read succeeds, the POST fails.
  await assert.rejects(() =>
    readAndSummarize({ paths: [filePath], query: 'x' }, { backstageUrl: 'http://127.0.0.1:1' }),
  );
});

test('readAndSummarize rejects when the backend returns a non-2xx status', async (t) => {
  const backend = createHttpServer((_req, res) => {
    res.writeHead(500);
    res.end('worker model exploded');
  });
  await new Promise<void>((resolve) => backend.listen(0, resolve));
  const port = (backend.address() as any).port;
  t.after(() => backend.close());

  const dir = await mkdtemp(path.join(tmpdir(), 'bulk-read-500-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, 'widget.ts');
  await writeFile(filePath, 'export function renderWidget() {}');

  await assert.rejects(
    () => readAndSummarize({ paths: [filePath], query: 'x' }, { backstageUrl: `http://127.0.0.1:${port}` }),
    /500/,
  );
});
