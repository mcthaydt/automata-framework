# EDS.1d-a The suite's Node adapters (git change set, Ship, argv checks, gates reader, Ask): TDD plan

- **Task:** EDS.1d in [02](../../02-master-delivery-plan.md), first half. [Editor suite spec](../specs/2026-10-30-editor-suite-design.md) §4.3 (ports), §4.5 (journal), §7 (checks and gates), §11 (failures), EDS-D1 (`./node` entry), EDS-D10 (Ship), acceptance EDS-j.
- **Lane:** editors. **Depends on:** EDS.1b (the ports and their contract suites in `editor-kit/ports/testing`), EDS.1c (`editor-suite/core`). **Unblocks:** EDS.1d-b, EDS.2c (Ship dialog, Review desk), COLLAB.1.
- **Status:** Implemented and locally checked 2026-10-30 (draft PR from `claude/editors-eds-1d-a-node-adapters`). Not CI verified. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed.
- **Progress:** 7 of 7 steps.

## The split, and why

EDS.1d is size L and its disk workspace stands on ED2D.9's server `ProjectStore`, which is not built yet. The split (approved by the coordinator, 2026-10-30):

- **EDS.1d-a (this plan):** the adapters that need only Node, git and a command line: the git change set with its journal, Ship through `gh` or the compare link, the argv checks runner (no shell, 200 KB output cap), the gates reader and Ask over the developer's own API key. Each is tested against the kit's port contract suite. Nothing waits on ED2D.9.
- **EDS.1d-b (later):** the disk workspace on ED2D.9's store (the allowlist from `editors.toml`, real paths, `expected: 'absent'`, `remove`), and wiring every adapter into `automata editor`. It waits on ED2D.9.

## Scope

**In:** `packages/editor-suite/src/node/` and its `./node` export; the change-set journal's schema in `editor-suite/core` (§4.5: "the suite holds the journal's shape, schema-validated on read").

**Out, with owner:** the disk workspace and `automata editor` wiring (EDS.1d-b); the model id and where the key is read from (EDS.1d-b, the CLI's flags and environment); the Ship dialog and the Review desk (EDS.2c); the `content` check (the suite's, EDS.2b); a live Ask check (Owner, optional, with a key).

## Interfaces

**Consumed:** `ChangeSet`, `ChecksRunner`, `CheckDef`, `CheckResult`, `Gates`, `GateState`, `AskProvider`, `AskRequest`, `Proposal` from `@mcthaydt/automata-editor-kit/ports`; `describeChangeSet`, `describeChecksRunner` (with `CHECKS_SCENARIO`, `CHECK_FINDING`, `CHECK_MEASURE`), `describeGates` (with `GATES_SCENARIO`), `describeAskProvider` from `.../ports/testing`; `EditorList`, `GateRow`, `globMatch` from `editor-suite/core`.

**Produced (`@mcthaydt/automata-editor-suite/node`, private):**

- `runArgv(argv, { cwd, env?, signal?, timeoutMs?, maxOutput? })`: one command with no shell; `{ code, signal, stdout, stderr, truncated, error? }`; output capped at 200 KB (`OUTPUT_CAP`).
- `createGitChangeSet({ root, tokenCap?, webUrl?, gh? })`: a `ChangeSet` plus `noteCreated(path)` (the disk workspace's call, EDS.1d-b). Branch `edit/<slug>` (The Last Light's); journal at `<git dir>/automata-editor/<branch>.json`.
- `createArgvChecks({ root, checks, sceneOf?, timeoutMs? })`: a `ChecksRunner`.
- `createGatesReader({ root, gates })`: a `Gates` over the list's `[[gate]]` rows.
- `createClaudeAsk({ apiKey, model, fetch?, maxOutputTokens? })`: an `AskProvider` over the Messages API.

**Produced (`editor-suite/core`):** `changeSetJournalSchema`, `type ChangeSetJournal` (format `af-change-set/1`).

## Decisions made here (defaults, listed for the Owner's veto)

1. **Check output.** A check prints JSON on stdout when it has findings: the suite's shape `{ findings?, measure? }` (the port's `CheckFinding` and `CheckMeasure`), or `automata check --json`'s `{ ok, steps: [{ findings: [{ file, line, col, rule, message }] }] }`, mapped to error findings. Exit 0 is `pass` (`warn` with only warning findings, `fail` with an error finding); exit 1 is `fail`; any other exit, a signal, a timeout, a missing command or unreadable JSON on a non-zero exit is `error` with the output. `automata pipe`'s JSON (automata-plus, M3.8a) is mapped when it exists.
2. **Candidates** are written to a fresh temporary folder at their relative paths, named to the check by `AUTOMATA_CANDIDATES`; the folder is removed when the check ends. `{path}` is the first candidate's path and `{scene}` its scene (`sceneOf`, from the editor list's row in EDS.1d-b); a check whose argv needs one with no candidate to give it is `error` ("needs a file"). Follow-up: an optional `path` on the run request for `after` checks (a kit port change, EDS.2b).
3. **Gate records** are JSON files `{ "gates": [{ "id", "decision": "approved" | "rejected" | "open", "decidedAt"?, "url"? }] }` (other keys ignored) at the row's `records` glob, `{scene}` matching any scene; the latest `decidedAt` wins when two files name a gate. The pipelines platform's real shape (automata-plus, M3.8a) replaces this when it lands; a file that does not parse rejects (the pill's "Gates not readable").
4. **Ship.** Push failure rejects with git's reason and the commits stay local. With `gh`: an open PR for the branch is reused (`gh pr view`), else `gh pr create --draft`; `gh` missing or failing gives only the compare link (EDS-D10). The compare link is the `origin` remote's web address (`git@github.com:o/r.git` becomes `https://github.com/o/r`) plus `/compare/<base>...<branch>?expand=1&title=…&body=…`, as the memory fake.
5. **Checkpoint** commits only the recorded files (`git add` then `git commit --only`); with none changed it gives `HEAD`. The open change set is the journal of the checked-out branch; `close` refuses while a recorded file differs from `HEAD`, then switches to the base and deletes the journal.
6. **Ask** sends the request as JSON in one user message and forces one tool call, `propose { summary, text }`; `max_tokens` is the smaller of the budget and `maxOutputTokens` (default 16 000); tokens used are the response's input plus output tokens. The model id has no default here: `automata editor` passes it (EDS.1d-b).

## Steps

Each step: write the test, run `pnpm --filter @mcthaydt/automata-editor-suite exec vitest run <file>` and see it fail for the reason named, write the code, see it pass.

- [x] **1. Plan** (this file).
- [x] **2. `runArgv`** — `src/node/run-argv.ts`, `run-argv.test.ts`. Fails first: module missing. Cases: exit code and output; no shell (`$HOME` stays literal); a missing command is `error` ENOENT; the 200 KB cap cuts and says so; abort and timeout kill the child.
- [x] **3. Journal schema** — `src/core/change-set-journal.schema.ts`, `.test.ts`, exported from `core/index.ts`. Cases: a journal round-trips; a negative token count, an unknown format or a missing `created` is refused.
- [x] **4. Git change set** — `src/node/git-change-set.ts`, `git-change-set.test.ts`: `describeChangeSet('git', …)` on a temporary clone of a local bare remote; plus EDS-j (a fake `gh` script gives a draft PR URL; without `gh` the compare link; the pushed branch holds only the recorded files), a push to a missing remote rejects and keeps the commit, `noteCreated` lists the file in `created`, and the journal is outside the work tree (`git status` stays clean of it).
- [x] **5. Argv checks** — `src/node/argv-checks.ts`, `argv-checks.test.ts`: `describeChecksRunner('argv', …)` with one small Node script per behaviour; plus `automata check --json`'s shape mapped, `{scene}` substitution from a candidate, a check needing `{path}` with no candidate is `error`, and the candidates folder is gone afterwards.
- [x] **6. Gates reader** — `src/node/gates-reader.ts`, `gates-reader.test.ts`: `describeGates('records', …)` writing `GATES_SCENARIO` as records files; plus `{scene}` records globs and the latest decision winning.
- [x] **7. Ask** — `src/node/claude-ask.ts`, `claude-ask.test.ts`: `describeAskProvider('messages api', …)` over a stubbed `fetch` that reads the request back from the body; plus the headers (key, version), a non-2xx response rejects with the API's message, and a reply without the tool call rejects.

## Gates

`pnpm format`; `TURBO_FORCE=true pnpm check`; the suite's `test:unit`. No published package changes (the suite is private: no changeset, no API report). No UI, so no parity or layout runs.

## Execution log

- **2026-10-30, steps 1 to 7.** Each test failed first on its missing module, then passed: `run-argv` 7, the journal schema 6 (with the core entry's export test), the git change set 20 (`describeChangeSet('git')` on a temporary clone of a local bare remote, EDS-j with a stand-in `gh` and without one), the argv checks 15 (`describeChecksRunner('argv')` with a stand-in `automata` on PATH), the gates reader 8 (`describeGates('records')`), Ask 8 (`describeAskProvider('messages api')` over a stubbed `fetch`), the `./node` entry 1. The suite: 147 tests.
- **Deviation:** the git adapter's `noteCreated` is async (it writes the journal), where the memory fake's is sync; the disk workspace (EDS.1d-b) awaits it.
- **Deviation:** `tooling/api-report/reports/editor-suite.api.md` tracks the private suite too, so the `./node` entry needed `pnpm api-report --update` (the api-report seams test failed first, then passed). No api-index or agent-skills entry covers the suite; no changeset (private).
- **Gates:** `pnpm format`; `TURBO_FORCE=true pnpm check` passed (36 and 34 tasks); `pnpm changeset status --since=origin/main` and `check-changesets` (0 problems). No UI changed: no layout or parity runs.
