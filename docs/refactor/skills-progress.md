# Bringing automata-skills up to date: progress

The Owner, 2026-11-07: "Have we been updating automata-skills, I know we worked on automata-plus", then "Oh, let's
handle that". Each stage runs in its own thread and hands off through the documents listed here. From stage 2 on they
live in the framework's `docs/refactor/` (audit decision D1 A); `mcthaydt/automata-skills` stays output only.

**Progress: 3 of 6 stages done (50%).**

| Stage | Status | Document | Pull request |
|---|---|---|---|
| 1. Audit | Done, 2026-11-07 | [2026-11-07-skills-audit.md](2026-11-07-skills-audit.md) (moved here; first written in automata-skills PR #1) | automata-skills #1, `claude/project-thread-l4q4y1` |
| 2. Plan and spec | Done, 2026-11-07 (accepted under "Auto accept all spec and plans") | [spec](2026-11-07-skills-spec.md), [plan](2026-11-07-skills-plan.md) | `claude/project-thread-wd20yh`, stacked on #444 |
| 3. Plan audit | Done, 2026-11-07: 15 findings, fixed in place | [2026-11-07-skills-plan-audit.md](2026-11-07-skills-plan-audit.md) | #446, same branch |
| 4. Build | In progress (5 parts, 17 tasks) | [execution ledger](#execution-ledger) | |
| 5. Build audit | Not started | | |
| 6. Fixes | Not started | | |

## Build tracking

| Task | Part | Status |
|---|---|---|
| 1.1 Mirror generator | 1 | Done, 2026-11-07 (13 tests) |
| 1.2 Release job and checks use it | 1 | Done, 2026-11-07 |
| 1.3 Part 1 close | 1 | Not started |
| 2.1 Declarations only (C1) | 2 | Done, 2026-11-07 |
| 2.2 What the reference leaves out (C2) | 2 | Done, 2026-11-07 |
| 2.3 Only published packages (D2 A) | 2 | Done, 2026-11-07 |
| 2.4 Both builder names (T3) | 2 | Done, 2026-11-07 |
| 2.5 Part 2 close | 2 | Done, 2026-11-07 |
| 3.1 Editor skill (C3) | 3 | Done, 2026-11-07 |
| 3.2 One sim import list (C4) | 3 | Done, 2026-11-07 |
| 3.3 Repository-only rules (C5) | 3 | Done, 2026-11-07 |
| 3.4 CSP, shipping, description (C6 to C8) | 3 | Done, 2026-11-07 |
| 3.5 `automata check` runs a workspace game's tests (M5) | 3 | Done, 2026-11-07 |
| 3.6 Part 3 close | 3 | Done, 2026-11-07 |
| 4.1 Install suite | 4 | Done, 2026-11-07 |
| 4.2 In release checks | 4 | Done, 2026-11-07 |
| 5.1 Site offers the plugin (after the first mirror push) | 5 | Not started |

## Hand-offs

- **Merge thread:** land part 1 before any `@automata/*` release, or the first mirror push has no marketplace file.
  Close automata-skills PR #1 once this PR merges (its audit now lives here). Closing #431 (V2) stays its call.
- **3D build ("Build the 3D slice"):** fold in spec section 7 (tasks 5.1, 5.2, 10.1, 11.1, 13.1, 13.2, 20.1). The audited
  3D plan (#445) did not.
- **Coordinator:** `automata check`'s test step on Emberwick ("failed to load config", audit M5) is now task 3.5 of
  this plan (stage 3). The 3D build thread has spec section 7's notes; tasks 2.3 and 2.4 say what to do if its 13.2 or
  10.1 lands first.
- **The Owner:** the npm organisation, `NPM_TOKEN`, the release approval and `SKILLS_TOKEN` (M4); one run of the install
  suite on the runner (task 4.2).

## Where stage 4 starts

Build with `superpowers:executing-plans`, natively (no subagents), Sonnet at high effort. Read the plan's Global
Constraints and Review Focus, then part 1. Part 1 lands before any `@automata/*` release. The plan's paths and lines
were checked at `8ee84442` (stage 3); recheck any line number against the stack head before editing it.

## Execution ledger

Stage 4, `superpowers:executing-plans`, inline. Pre-flight: tasks 1.1 to 1.2 share the CLI and `writeMirror`; 4.1 consumes
`writeMirror` (task 1.1); 5.1 reads the plugin:validate pin that 1.2 rewrites (the pin string is unchanged). No conflicts.

- Task 1.1: complete (`tooling/agent-skills/tests/unit/mirror.test.ts`, 13 tests green; RED was "Cannot find module '#src/mirror.ts'").
  Ruling: the CLI case became three tests (exit 0, 1, 2), so 13 tests not 10 — finer names, same coverage — none if wrong.
  Ruling: `mirror.ts` imports only `node:` built-ins and does not import `./skill-tree.ts` (it needs no hashing) — the
  plan allowed that import but nothing uses it — none if wrong.
- Task 1.2: complete (`ci.test.ts` 3 new tests RED→GREEN; agent-skills 127/127; repo-hygiene 90/90). The three trees
  (`agents/automata`, `.`, `.mirror/automata-skills`) validate `--strict` on Claude Code 2.1.301 ("Validation passed" x3).
  Re-enacted on a clone of automata-skills (emptied but `.git`, CLI, `marketplace add`, `install`): `plugin details` says
  "Skills (5) …", "Hooks (2) PostToolUse, Stop". Nothing pushed.
  Ruling: `release-checks.yml` is not edited: it already runs `pnpm plugin:validate`, which now builds and validates the
  mirror — an edit would run it twice — none if wrong.
- Task 2.1: complete (`reexport.test.ts` 2 tests and `reference.test.ts` 7 tests RED→GREEN; api-index 45/45, api-report 45/45, site 340/340).
  The regenerated `api.md` loses the six definers' bodies and the overload implementations; `docs/cheatsheet.md` loses
  one phantom `defineSystem(nameOrSpec, …)` overload. `pnpm api-index` says "0 undocumented".
  Ruling: the re-export tests live in a new `tests/unit/reexport.test.ts` (the fixture needs a temp copy with
  `node_modules` links), not in `rows.test.ts` — rows.test.ts reads a committed fixture — none if wrong.
  Ruling: `declarationExports`'s `paths` is typed `Record<string, string[]>` (not readonly) because TypeScript's
  `CompilerOptions.paths` is — none if wrong.
- Task 2.2: complete (`skill-content.test.ts` RED "to contain `@automata/framework/target`" → GREEN, 135/135).
- Task 2.3: complete (`published-only.test.ts` 4 tests; the module-missing RED, then GREEN). The published-only case
  passes on today's tree: no unpublished package is named, and the 3D build's 13.2 has not landed on this stack.
- Task 2.4: complete (`source-names.test.ts` 2 new cases RED→GREEN; repo-hygiene 93/93; `pnpm source-names` 0 findings).
  The 3D build's 10.1 has not landed on this stack, so the pattern and the `agents/` extensions are added here.
- Task 3.1 to 3.4: complete (each RED→GREEN in `skill-content.test.ts`, `skills-text.test.ts`, `layout.test.ts`,
  `platform-imports.test.ts`; agent-skills 150/150, tools 711 passed 1 skipped).
  Ruling (3.4): the shipping bullet names `pnpm build:<target>`, `pnpm prepare:<target>` and `automata ship prepare|publish`,
  not `automata build` — there is no `automata build` command (create-game writes the `build:<target>` scripts), and
  `publish` exists for `itch` and `ruken` only (web is uploaded by hand, desktop goes to itch with `--from tauri`). The test
  asks for `pnpm build:` instead of `automata build` — an agent following the plan's words would run a missing command.
  Ruling (3.4): the "Ruken's CSP" reasons say "a strict Content-Security-Policy (the headers Ruken sends)" or "no web
  target allows that"; the `--csp` line keeps the plan's "under Ruken's rules" — each is true of the code (`csp-probe-live.ts`).
  Ruling (3.3): the ten repository-only rows sit in a section at the end of the verify skill, so "after the heading and
  not before it" holds without a second heading — none if wrong.
- Task 3.5: complete (`run-check.test.ts` RED→GREEN, tools 711 passed). On Emberwick the failure changed: before,
  `ERR_MODULE_NOT_FOUND … packages/content/src/features/vite/index` (config would not load); after, the config loads and
  the unit project runs, but `automata check --sim-only .` still ends "0 findings, 1 step could not run" because
  Emberwick's browser projects need Firefox and WebKit, which this session does not have (`browserType.launch:
  Executable doesn't exist … firefox-1543`). That is the session, not the code; the runner has them. Changeset added.
- Task 4.1: complete (typecheck clean; ran the suite here: `pnpm --filter @automata/agent-skills test:install` → 10 passed,
  28 s, with the pinned Claude Code 2.1.301 from the scratchpad on PATH). First attempt failed on a bug of mine (the
  per-source config folders sat beside the mirror folder, so `writeMirror` refused it); fixed by putting them under `env/`.
  The suite covers: version pin read from the root script; `--strict` validation of the plugin, the framework marketplace
  and the mirror; for each source `marketplace add`, `install`, `details` (`Skills (5)`, `Hooks (2)  PostToolUse, Stop`)
  and a byte-for-byte skills diff; the installed mirror hook blocking a seeded `effect` import (exit 2, rule `import`)
  and passing a clean `move.system.ts` in a `create-game` game installed from the packs; `npx skills@1.7.0 add` of the
  mirror for Claude Code, Codex and Cursor. The plan expected a session to refuse this; this one did not.
- Task 4.2: complete (`ci.test.ts` RED→GREEN, agent-skills 151/151, repo-hygiene 93/93). `release-checks.yml` installs the
  pinned CLI under `$RUNNER_TEMP`, puts it on `GITHUB_PATH` and runs `test:install` after the consumer smoke. The job's
  40-minute limit stays (the suite took 28 s here). Step 5 (a first run on the runner) is the Owner's, or the job's first run.
