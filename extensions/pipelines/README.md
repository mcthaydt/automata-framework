# `@automata/pipelines` (Automata Plus, private)

A game's content pipelines: the `automata-pipe` command line for people, and the `automata-pipe-mcp` server for
agents. Plans: `docs/superpowers/plans/2026-10-30-m3-8a-pipelines-platform.md` and `…-m3-8b-pipelines-mcp.md`.

## In a game

- `pipeline.toml` at the game's root holds the budgets, the generated paths and the locked values.
- Register the server for the agent's client, started in the game's root:
  `{ "mcpServers": { "pipelines": { "command": "automata-pipe-mcp" } } }`.
- Gates are decided by people only: `automata-pipe <pipeline> approve <target> <gate>` in a person's own terminal, or
  the form `pipeline_request_review` shows them. An agent's `approve` or `reject` is refused (exit 4) and logged.

## What to commit and what to ignore

Commit `pipeline-spend.json` (the spend ledger), `docs/pipeline-audit.jsonl` (the audit log, one line per agent call)
and each target's `.stage.json` and `gates.json`. Ignore the two locks, which exist only while a command runs. Add these
lines to the game's `.gitignore`:

```gitignore
.pipeline.lock
pipeline-spend.lock
```

A lock whose process has ended is taken over by the next command, so a crash does not block the game for good.
