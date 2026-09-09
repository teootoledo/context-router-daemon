# @teootoledo/context-router-daemon

A local [MCP](https://modelcontextprotocol.io) server that runs on a developer's machine and owns all filesystem access for the context-router system. It exposes a `bulk_read_files` tool to a coding agent: the agent asks for a batch of files by path and a query, the daemon reads their content off disk and forwards it to a remote [context-router-backend](https://github.com/teootoledo/context-router-backend) instance, which condenses it into a short summary via a worker LLM. Raw file content never enters the calling agent's own context window — only the summary does.

This repo also owns the [benchmark](./bench/bulk-read-bench.ts) that measures the actual token savings of that round-trip against a real backend.

## Install & run

```bash
npm install
npm start          # runs the MCP server over stdio
npm test           # tsx --test test/*.test.ts
npm run bench      # measures token savings against a running backend
```

Depends on [`@teootoledo/context-router-contract`](https://github.com/teootoledo/context-router-contract) — see that repo for what it defines and why.

Node 22+. TypeScript runs through [`tsx`](https://github.com/privatenumber/tsx), never `node --experimental-strip-types` — no Jest, no Vitest, no build step.

**Known limitation:** the package's `bin` entry points at raw TypeScript with no shebang, so `npx @teootoledo/context-router-daemon` does not yet work as a direct executable — use `npm start` for now. Supporting bare `npx` execution needs either a build step or a compiled shim, both a deliberate non-goal while this project stays tsx-only.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
