import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.ts';
import { resolveBackstageUrl } from './config.ts';
import { registerBulkReadFiles } from './tools/bulkReadFiles.ts';

const backstageUrl = resolveBackstageUrl();
const server = createServer();
registerBulkReadFiles(server, { backstageUrl });

await server.connect(new StdioServerTransport());
console.error(`context-router-daemon: connected, backend at ${backstageUrl}`);
