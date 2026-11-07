# Automata Plus as framework extensions: progress

**Overall: 50% (3 of 6 stages done; stage 4 is 18 of 27 tasks).**

The Owner, 2026-11-07: "do automata-plus too" (11:19); then, on where: "Actually no make them extensions because
they're free anyway, and move the stuff 3D is doing here, and cut the starter" (15:05). Plus's packages are ported into
this repository as `extensions/<name>`, `@automata/sectors` and `@automata/cutscenes` replace what the 3D plan's tasks 7.1
and 7.4 would have written, and the starter is not ported. Six stages, each in its own session:

1. **Audit** (Opus, extra-high effort): what is there, measured.
2. **Plan and spec** (Opus, medium, with the superpowers plugin).
3. **Plan audit** (Opus, medium).
4. **Build** (Sonnet, high), updating this page as each step lands.
5. **Build audit** (Opus, medium): complete, consistent, matches the spec and the codebase.
6. **Fixes** (Sonnet, high): every finding from stage 5 closed.

Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and how to use it?

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-07, in `mcthaydt/automata-plus` PR #40 (head `4cb70b9`), moved here: C1 to C9, E1 to E4, L1 to L6, D1, G1 to G4, X1 to X4, P1 to P4; P-D1 to P-D11. P-D1: the Owner chose B (15:05) after A (15:02). `pnpm check` and the Chromium browser suites pass on Plus's pinned core | [audit](2026-11-07-plus-audit.md) |
| 2. Plan and spec | Done, 2026-11-07, with the superpowers plugin (`brainstorming`, `writing-plans`), native: P-D2 to P-D11 decided (P-D11 departs from the audit: B, because core never imports an extension); 3 parts, 4 phases, 19 tasks; the 3D plan's tasks 7.1, 7.4 and 12.1 change (spec section 9) | [spec](2026-11-07-plus-port-spec.md), [plan](2026-11-07-plus-port-plan.md) |
| 3. Plan audit | Done, 2026-11-07, with the superpowers plugin (`writing-plans`' self-review), native: 16 findings (F1 to F16), all fixed in the spec and the plan; P-D11 B confirmed sound with F5's fix; one change to the 3D plan's 7.1 (`zone`, `masses`, `cut`, `hideFrom` in `af-sector/2`, spec section 9). Spec accepted | [plan audit](2026-11-07-plus-port-plan-audit.md) |
| 4. Build | In progress, PR #458 (on #457): phase 1 done and gated (tasks 1.1 to 1.4, 2.1); tasks 2.2 (physics, puzzle), 2.3 (feel without Effect, audio-synth, debug) 2.4 (net without Effect, net-server, net-ui) 2.5 (`ui-screens` as a package) 2.6 (`sectors`, `nav`, `systems`, `narrative`, `cutscenes` by feature) and 2.7 (`pipelines` on the editor's gate shape, `dev-tools` tests in `tests/`) and 2.8 (the catalog, the stack page, the pins, the README) done; part A is complete. Part B: 3.1 (`@automata/3d/timeline`, after 3D 6.3) done; 3.2 is done, 3.3 is unblocked (3D 7.4 is merged in), 3.5 waits for 3D 12.1. WebKit and Firefox parity pending on the Owner's Mac | [plan execution log](2026-11-07-plus-port-plan.md) |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

## Where to resume (2026-11-07, stage 4 in progress)

Branch `claude/project-thread-d62n7h` (PR #458, on #457). Tasks 1.1 to 1.4, 2.1 to 2.8, 3.1, 3.2, 3.4 and 4.1 are done; the plan's execution log
has each one's counts and the ledger (`.superpowers/sdd/2026-11-07-plus-port-plan/progress.md`, git-ignored) its rulings.
Resume at **3.3** (`cutscenes` takes the director; 3D 7.4's `PieceStates` and `updatePieces` are in this branch, merged from `claude/project-thread-50d3sw`, PR #463, through 7.4); 3.5 needs 3D 12.1, and 4.2 closes. Phase 5's 5.2, 5.3 and 5.4 are done; 5.1 waits on 3D 7.5, 3.6 on 7.6, 3.7 on 7.5, 3.8 on 3.7 and 8.2, 3.9 on 3.6 to 3.8 and 12.1, and 5.5 closes the refactor. 3.7 and 3.8 were amended at 20:01 (the base pair, the base interior and exterior and the sky stay in 3D core; see the plan).
The moves use `docs/refactor/move-map-plus.json` (rows per package, `entries` empty; give the mover a temporary map whose
`sources` holds only the package being moved) with `node tooling/codemods/src/move-modules-cli.ts --map <map>`, then
`tooling/codemods/src/cli.ts <pkg> --environment node|jsdom --feature-folders`; a test file with an unknown qualifier
(`x.settings.test.ts`) is renamed first. Per package afterwards: `package.json` exports and scripts, `vitest.config.ts` as
`defineTests` (add `@automata/vitest-preset` to devDependencies and run `pnpm install`), `tsconfig.json` includes `tests/**`,
the root `package.json` `--features`, `--plan-comments`, `--test-imports` and `--forbid …:effect` lists, then `pnpm style`,
`pnpm boundaries`, `pnpm source-names` and `pnpm knip`. Comments name the reason, never a plan or the project a file came from.
