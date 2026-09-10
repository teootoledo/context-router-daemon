---
name: bulk-reader
description: "Delegate bulk file reading to the context-router backend. Use when you need to read files over 350 lines, answer a question across 3+ files, or summarize a large diff."
---

Call the `bulk_read_files` MCP tool instead of reading large files directly:

- `paths`: the file path(s) to read.
- `query`: what you actually need to know from them.

Each call is independent — the daemon reads the files and sends them to a worker model, which returns only a condensed summary; the raw content never enters your context window. To ask a follow-up, call it again with the same `paths` — re-sending them costs nothing extra since they never reached you.

Verify specific line numbers or exact values before using them in an edit — a summary loses precision that raw content wouldn't.
