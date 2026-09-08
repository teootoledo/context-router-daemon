import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createServer(): McpServer {
  return new McpServer({ name: 'context-router', version: '0.1.0' });
}
