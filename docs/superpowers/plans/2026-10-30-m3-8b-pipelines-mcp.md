# M3.8b: `pipelines` platform part 2 (MCP server, review elicitation, audit log), TDD plan

- **Spec:** the framework's M3 spec (`docs/superpowers/specs/2026-10-16-m3-25d-pipelines-design.md`) §4.8 (gates:
  "`approve` and `reject` are for people only: the MCP server exposes `pipeline_request_review`, which asks the person
  through MCP elicitation and records their answer; an agent cannot call `approve`"; the audit log: "every MCP tool
  call appends one JSON line (`at`, `tool`, `args`, `ok`, `summary`, `ms`, `head`) to the game's
  `docs/pipeline-audit.jsonl`"), §5 (the pipeline run flow: "the person approves through MCP"), §6 (the row "An agent
  calls `approve`: refused (exit 4); only `pipeline_request_review` can record a decision, and only from a person's MCP
  answer"), §7 (the review's states: asked, approved, rejected, cancelled, timed out, "recorded as 'the owner did not
  decide'"), §13 PL-c and PL-d. The revised M3 spec (`2026-10-18-m3-3d-characters-design.md`) §4.6 leaves the platform
  unchanged and keeps the review's states in its §7.
- **Row:** M3.8b in the framework's `docs/02-master-delivery-plan.md`: "The MCP server with `pipeline_request_review`
  through elicitation; an agent's `approve` is refused with exit 4 and logged; one audit line per tool call, with head;
  PL-c, PL-d."
- **Prerequisite:** M3.8a (merged, PR #7): `tooling/pipelines`, the router, the runner, the stage cache, budgets, gates.
- **Branch:** `claude/plus-M3.8b-mcp-audit`.
- **Sources (read only):** The Last Light (`PixiJS3D_Experiment_001`) at
  `92e67047a33161c5cfb1c5f9d8b981e91e1c55b9`: `scripts/mcp/server.ts` (11 lines; the stdio entry),
  `scripts/mcp/tools.ts` (452; the tools, estimate tokens, elicitation, redaction, the audit), `scripts/mcp/contracts.ts`
  (95; the tool names and inputs), `scripts/pipeline/contracts.ts` `AuditEntry`, `tests/mcp-server.test.ts` (the
  server through the SDK's in-memory client), `.mcp.json`, and the format of `docs/pipeline-audit.jsonl`. Ported as
  behaviour specs on Effect; nothing is copied unchanged (the source spawns its CLI for every call and signs tokens
  with `node:crypto` HMAC; this calls the runner in-process and keeps tokens in the server's memory).
- **Status:** implemented and checked locally (`pnpm check` green); Plus CI on the Mac pending; Owner review of D1 to D9
  pending.

## Scope

In: in `tooling/pipelines`, the MCP server (`createPipelinesServer`, the bin `automata-pipe-mcp` over stdio), its seven
platform tools, `pipeline_request_review` through elicitation, estimate tokens for paid runs, the audit log (one line
per tool call, with the git head, secrets redacted), the router's refusal of an agent's `approve` and `reject` (exit 4,
with an audit line), PL-c and PL-d.

Out (later rows): the guard, `guard_check` and the `PreToolUse` hook (M3.8c; the hook is where The Last Light also
blocks `--paid` and hand edits of `gates.json` from an agent's shell); the character and props pipelines (M3.9);
registering the server in a game's `.mcp.json` (DX.7's plugin, M3-D12); the game-specific tools of the source
(puzzle, systems, narrative, cutscene, audio, vision, direction) and `pipeline_list`'s repository walk for targets.

## Files

- `tooling/pipelines/package.json`: `@modelcontextprotocol/sdk` 1.32.1 (the version The Last Light runs), the bin
  `automata-pipe-mcp: ./src/mcp-cli.ts`.
- `src/redact.ts`: `redact(text, env)`.
- `src/audit.ts`: `AUDIT_LOG`, `AuditEntry`, `auditEntrySchema`, `gitHead(root)`, `appendAudit(path, entry, env)`,
  `projectRootOf(target, config)`.
- `src/agent.ts`: `isAgent(env)`, `AGENT_VARIABLES`.
- `src/router.ts` (modify): `route(argv, pipelines, planned, caller)`; an agent's `approve`/`reject` is exit 4 and one
  audit line.
- `src/cli.ts` (modify): passes `{ agent: isAgent(process.env), env: process.env }`.
- `src/estimate-token.ts`: `EstimateTokens` (issue, check; 30 minutes on Effect's `Clock`).
- `src/review.ts`: `requestReview(...)`: the elicitation and its outcomes.
- `src/mcp-tools.ts`: the tool table (name, description, Zod input, handler).
- `src/mcp-server.ts`: `createPipelinesServer(options)`: the low-level SDK `Server`, `tools/list`, `tools/call`, the
  audit around every call.
- `src/mcp-cli.ts`: the stdio bin.
- `src/index.ts` (modify): exports.
- Tests: `src/redact.test.ts`, `src/audit.test.ts`, `src/agent.test.ts`, `src/router.test.ts` (added cases),
  `src/cli.test.ts` (added cases), `src/mcp-server.test.ts`, `src/review.test.ts`, `src/mcp-cli.test.ts`,
  `src/acceptance-mcp.test.ts` (PL-c, PL-d).

## Interfaces

```ts
export const AUDIT_LOG = 'docs/pipeline-audit.jsonl'          // under the project root
export interface AuditEntry {                                 // The Last Light's AuditEntry, one JSON line
  at: string; tool: string; args: unknown; ok: boolean; summary: string
  cost?: Record<string, number>; ms: number; head: string    // head: `git rev-parse HEAD`, or 'unknown'
}
export const gitHead: (root: string) => Effect.Effect<string, never, ProcessRunner>
export const appendAudit: (path: string, entry: AuditEntry, env: Env) => Effect.Effect<void, string>
export const projectRootOf: (target: string, config?: string) => Effect.Effect<string, never, Files>
export function redact(text: string, env: Env): string        // key values and key-shaped strings → [redacted]
export function isAgent(env: Env): boolean                    // CLAUDECODE=1 or AUTOMATA_AGENT=1
export interface Caller { readonly agent: boolean; readonly env?: Env }
export const route: (argv, pipelines, planned?, caller?: Caller) => Effect.Effect<RouterOutput, never, StageServices>
export interface ServerOptions {
  readonly root: string                                       // the project root: targets stay inside it
  readonly pipelines: readonly PipelineDef[]
  readonly planned?: readonly string[]
  readonly runtime: ManagedRuntime.ManagedRuntime<StageServices, never>
  readonly auditPath?: string                                 // default <root>/docs/pipeline-audit.jsonl
  readonly reviewTimeoutMs?: number                           // default 15 minutes
  readonly env?: Env                                          // for redaction; default process.env
}
export function createPipelinesServer(options: ServerOptions): Server
export const TOOL_NAMES: readonly ToolName[]
// pipeline_list · pipeline_status · pipeline_estimate · pipeline_run · pipeline_check
// · pipeline_request_review · pipeline_review_status
```

Server semantics:

1. **Tools.** Each tool takes a Zod input (strict: an unknown key is an error); `tools/list` gives its JSON Schema
   (`z.toJSONSchema`). `pipeline` is a registered or planned name; `target` is relative to the root and must stay
   inside it and exist. The answer is the runner's `PipelineResult` as JSON text. Exit 0 (done) and 3 (at a gate) are
   answers; any other exit is a tool error (`isError`) whose text is still the one JSON result.
2. **No tool decides a gate.** A call to any tool that is not in the table is refused; one whose name says it decides
   (`approve`, `reject`, `decide`) is refused with `exit: 4` and the message that only a person decides, through
   `pipeline_request_review`. Both are logged.
3. **Estimate tokens.** `pipeline_estimate` returns the plan and a token (a random UUID kept in the server's memory with
   the pipeline, target, planned stage ids, their input hashes and the time). `pipeline_run` with paid stages in its
   plan needs a token issued by this process, at most 30 minutes old (Effect's `Clock`), for the same pipeline,
   target, stages and input hashes; then it runs with `paid: true`, and the runner's budgets and ledger still apply.
   Otherwise it is refused (exit 4) and nothing runs.
4. **Review.** `pipeline_request_review` reads the gate. Not pending: it answers with the decision already recorded.
   Pending: it records the request (the runner's `request`, with the summary of what to review). Without the
   client's elicitation capability it answers with the person's command (`automata-pipe <p> approve <target> <gate>
   --note "…"`) and the instruction not to run it. With it, it asks through `elicitation/create` (a form: decision
   approve or reject, an optional note) with a timeout (15 minutes): accept with a decision records it through the
   runner's `approve` or `reject` (`by: 'owner'`, the note); decline, cancel, a timeout or an answer without a
   decision leave the gate pending and answer "the owner did not decide (<why>)".
5. **Audit.** Every `tools/call` that reaches the server, whatever its outcome (an unknown tool, invalid input, a
   refusal, a failure or a success), appends exactly one line: `at` (Clock, ISO), `tool`, `args` (as given), `ok`
   (false for a tool error), `summary`, `cost` (units the spend ledger grew by during the call, only when it grew),
   `ms` (Clock), `head` (`git rev-parse HEAD` in the root at the call; `unknown` outside Git). Key values and
   key-shaped strings are redacted in the line and in every answer.
6. **The router.** With `caller.agent`, `approve` and `reject` are refused before the target is read: exit 4, the one
   JSON object with `--json`, the gate untouched, and one audit line (`tool: 'automata-pipe <command>'`, `ok: false`)
   in the project's log (the folder holding the nearest `pipeline.toml`, or the working folder without one).
7. **The bin** `automata-pipe-mcp` serves the registry over stdio from the working folder (the project root); stdout
   is the protocol, logs go to stderr.

## Decisions for the Owner's veto (defaults in effect)

- **D1, an agent is told by its environment.** The bin `automata-pipe` treats its caller as an agent when `CLAUDECODE`
  is `1` (Claude Code sets it for every command its agent runs) or `AUTOMATA_AGENT` is `1` (for any other agent's
  runner to set). A person runs `approve` from their own terminal; one typed through Claude Code's own shell is
  refused too. The PreToolUse hook (M3.8c) is the second line, as in The Last Light.
- **D2, the server calls the runner in-process.** The source spawned its CLI per call. Here each tool runs
  `runPipeline` in the server's `ManagedRuntime`, so the person's elicited decision goes through the runner's own
  `approve` (the same code path as the CLI) without the router's agent rule, which the server, started by the agent's
  client, would otherwise trip. No other path in the server reaches `approve` or `reject`.
- **D3, the low-level SDK `Server`, not `McpServer`.** `McpServer` rejects unknown tools and invalid input before any
  handler runs, so those calls would leave no audit line (the source's behaviour). Handling `tools/list` and
  `tools/call` directly logs every call (PL-c says every call) and lets an agent's `pipeline_approve` be refused with
  exit 4 and logged (PL-d).
- **D4, estimate tokens live in the server's memory** (a random UUID per estimate), not an HMAC string: same
  guarantee within one process (the source's secret was per process too), no `node:crypto`. A restarted server
  forgets them; the agent estimates again.
- **D5, the audit line is appended with `node:fs`** (`appendFileSync`, one write per line, so concurrent writers do not
  interleave on a local disk). Core's `Files` has no append; a third framework request beside `readBytes` and
  exclusive create/rename (M3.8a D7, D10).
- **D6, `cost` comes from the spend ledger** (`pipeline-spend.json`, M3.8a D2): the units it grew by during the call.
  The source summed spend from the audit log; here the ledger is the record and the line repeats it.
- **D7, redaction covers the M3 providers** (`OPENAI_API_KEY`, `MESHY_API_KEY`, and `sk-…`, `msy_…` shapes). The
  source's fal.ai and ElevenLabs keys belong to pipelines M3 does not move (M3-D10).
- **D8, the review's outcomes.** Accept with a decision is recorded; decline, cancel, a timeout or a closed connection
  leave the gate pending and the answer and the audit summary say "the owner did not decide (<why>)". Nothing is
  written to `gates.json` for an undecided review beyond the request (`requestedAt`, the summary).
- **D9, the CLI's refusal is the only router line in the log.** The log is the MCP tool calls' record (spec §4.8); the
  router appends only the refused `approve`/`reject`, which PL-d asks to be logged. A person's own CLI commands are
  not logged here (their decisions are in `gates.json` with `by` and `decidedAt`).

## Ported and dropped source cases (`tests/mcp-server.test.ts`)

| Source case | Here |
|---|---|
| lists the platform tools with their input schemas, and none that approves | ported (seven tools; `guard_check` is M3.8c) |
| validates input and keeps targets inside the repo | ported, plus: the invalid call is logged |
| runs free stages to a gate, and refuses an unestimated paid run (and a forged token) | ported |
| runs a paid stage with a matching estimate token, records the spend, and redacts keys | ported (cost from the ledger) |
| refuses a stale or expired token | ported (TestClock) |
| writes one audit line per call, with the git head and duration | ported, and extended to invalid input and unknown tools |
| without elicitation, a review request names the owner's command and decides nothing | ported |
| with elicitation, the owner's answer is recorded through the CLI's approve | ported (the runner's approve) |
| with elicitation declined, the gate stays pending | ported, plus cancel and an answer without a decision |
| with the form left unanswered, the request ends, the gate stays pending | ported |
| runs the guard validators | **dropped** (M3.8c) |
| redaction of OpenAI and Meshy keys | ported |
| redaction of fal.ai and ElevenLabs keys | **dropped** (D7) |
| the game's own tools (`puzzle_*`, `systems_*`, `narrative_*`, `cutscene_*`, `audio_*`, `vision_check`, `direction_audit`) | **dropped** (game-specific; M3-D10) |

## Tests, written first

- [x] 1. **Redaction** (`redact.test.ts`): a key variable's value, an `sk-` and an `msy_` shaped string become
      `[redacted]`; a value shorter than 4 characters is left alone; other text is unchanged.
- [x] 2. **Audit** (`audit.test.ts`): `appendAudit` writes one line per call, creating `docs/`; the line parses with
      `auditEntrySchema`; key values in `args` and `summary` are redacted; `gitHead` is the repository's `HEAD` in a
      temp Git repository and `unknown` outside one; `projectRootOf` is the folder of the nearest `pipeline.toml`, the
      folder of `--config`, or the working folder.
- [x] 3. **Agent** (`agent.test.ts`): `isAgent` is true for `CLAUDECODE=1` and `AUTOMATA_AGENT=1`, false otherwise
      (unset, `0`, empty).
- [x] 4. **Router** (`router.test.ts`): an agent's `approve` and `reject` exit 4 with one JSON object naming
      `pipeline_request_review`, leave `gates.json` unchanged and append one audit line (`ok: false`); an agent's
      `status` and `run` work; a person's `approve` still works and logs nothing.
- [x] 5. **Bin** (`cli.test.ts`): `CLAUDECODE=1 automata-pipe <toy> approve …` is not testable on the empty registry,
      so the bin's case is the wiring: with `CLAUDECODE=1`, `approve` of a planned pipeline exits 4 (refused before the
      registry is consulted) and writes the line in the working folder; with the agent variables removed it exits 2.
      The bin's other tests now run with the agent variables removed, so they pass whoever runs them.
- [x] 6. **Server** (`mcp-server.test.ts`, the SDK's in-memory client, the toy pipeline in a temp folder): every ported
      case above, the unknown-tool and approve-tool refusals, the strict input.
- [x] 7. **Review** (`review.test.ts`): accept approve, accept reject (the stage runs again on the next run), decline,
      cancel, accept without a decision, a timeout with a late answer that records nothing, an already decided gate,
      an unknown gate.
- [x] 8. **Stdio bin** (`mcp-cli.test.ts`): `node src/mcp-cli.ts` through the SDK's stdio client: the seven tools, and a
      `pipeline_list` call writes one audit line in the working folder.
- [x] 9. **PL-c, PL-d** (`acceptance-mcp.test.ts`, a temp Git repository): PL-c: every call (list, status, estimate, run,
      request_review, review_status, an invalid one, an unknown one) adds exactly one line, whose `head` is
      `git rev-parse HEAD` at that call (a commit between two calls changes it). PL-d: the agent's `approve` through
      the router exits 4, the gate stays pending, and the log has the refusal line; through the server,
      `pipeline_approve` is refused with exit 4 and logged; only the person's elicited answer approves the gate.

## Gates

`pnpm format`, `pnpm check` (lint, typecheck, boundaries, the root tooling tests with F1, every package's unit tests
through `pnpm -r`). No browser project: nothing here renders. Pending: the Plus CI run on the Mac.

## As built (deviations)

- The server answers a planned pipeline (`character`, `props`) with exit 2, as the router does, so its `pipeline`
  enum lists registered and planned names.
- Tool answers carry the target as the tool was given it (relative to the root), not the absolute path the runner was
  called with.
- An audit line that cannot be written turns the call into a tool error naming the log, so no call is answered as if
  it were logged. The router's refusal stays exit 4 and adds the log error on stderr.
- The audit `summary` is cut at 500 characters (the source cut failures at 300).

## Execution log

| Date | Step | Evidence |
|---|---|---|
| 2026-10-30 | Plan | this file, committed alone (`56ce176`) |
| 2026-10-30 | Redaction, audit, agent (tests 1 to 3) | 3 files red (`Cannot find module`), then 7 of 7 |
| 2026-10-30 | Router (test 4) | 2 red (`expected +0 to be 4`: the agent's approve went through), then 20 of 20 |
| 2026-10-30 | Bin (test 5) | 1 red (`expected 2 to be 4`), then 4 of 4; `registry.ts` now holds the bins' shared (empty) registry |
| 2026-10-30 | Server and review (tests 6, 7) | both files red (`Cannot find module '../mcp-server.ts'`); then 1 failure: the SDK checks an elicitation reply against the form's schema, so an accepted form without a decision arrives as an `InvalidParams` error, now mapped to "no decision"; 19 of 19 (TestClock drives the 30-minute token through the server's `ManagedRuntime`) |
| 2026-10-30 | Stdio bin (test 8) | red (`Connection closed`: no `mcp-cli.ts`), then green |
| 2026-10-30 | PL-c, PL-d (test 9) | written after the server, so their failure was shown by mutation: with `gitHead` always `unknown` both fail; with the router's agent rule disabled PL-d fails; restored, 2 of 2 |
| 2026-10-30 | Gates | `pnpm format`; `pnpm check`: lint 224 files, typecheck, boundaries, root 163 (F1 over `tooling/*` included), pipelines 115 (16 files), net 89, dev-tools 62, physics 71, server 269 |
