# The builders' look and figures in the framework: plan audit

**Date:** 2026-11-11. **Stage:** 3 (plan audit) of workstream 4. **Tracker:** [`../progress.md`](../progress.md).
**Audited:** [the plan](../plans/2026-11-11-builders-look.md) and [the survey](2026-11-11-builders-look-survey.md) as
merged at `main` `b80bfc84` (#636), against [the spec](../specs/2026-11-11-builders-look-and-figures-design.md),
`AGENTS.md`, the tracker's decisions list and editor gaps ledger, workstream 2's
[spec](../specs/2026-11-11-last-light-on-the-framework-design.md) ("Where a new piece goes") and
[plan](../plans/2026-11-11-last-light-prologue.md) (tasks 9b and 13), workstream 1's build branch
`claude/shared-polish-build` at `29ccea7f`, [`../../refactor/eb-look/gap.md`](../../refactor/eb-look/gap.md) and
[`../../refactor/2026-11-07-3d-scope-trim.md`](../../refactor/2026-11-07-3d-scope-trim.md), the code on `main`, and the
drafts at the heads the plan names: #589 `claude/eb-look-glow` `0024f81a`, #590 `claude/eb-look-effects` `22b63b54`,
#607 `claude/c8-lit` `7167af1f`, #588 `claude/tll-extensions-1` `8e348d9a`, #603 `claude/c8-lit-spec` `70cc66c4` (none
has moved). FigureBuilder (read only) at the framework's pin `d6e3c9f`, its `main` `23f889c` and #29's head `856498a`;
EnvironmentBuilder (read only) at `main` `f7c5356`, the commit the survey shot.

## What was run

Everything here was run in this session on a 4-core container, headless Chromium on software WebGL. Nothing was pushed
from a scratch branch, and nothing was committed inside FigureBuilder or EnvironmentBuilder.

| What | Where | Result |
|---|---|---|
| `pnpm install --frozen-lockfile`, the submodule at its pin | `main` `b80bfc84` | Clean |
| The survey's `shoot.mjs`, all 12 scene sheets and the figure sheets | `main` | Every number within 0.1 of `shots.json` (the survey's table holds) |
| The same | the trial: `main` + #589 merged + `680bbc31a` cherry-picked (no conflict) | See "The measures, again" below |
| The plan's `lit-room.test.ts`, as written, Chromium | `main`; `main` + #589; the trial | Fails on `main` (`saw 13, 13, 13`; brightness 6.2) and on `main` + #589 (13; 6.9); passes on the trial (64, 64, 64; 42.1). **It does not typecheck** (finding 1) |
| The same test with finding 1's fix | the trial | Passes; `tsc -p packages/3d` and `biome lint` clean |
| The merge order: `main`, then #589 with the fix, then #607, then #590 | scratch branches, never pushed | #589 and the fix: no conflict. #607: no conflict. #590: one conflict, `spikes/eb-look/probe.mjs` (add/add), taken as the branch's, as task 10 says |
| `pnpm check`, each step alone, on each state of the order | the three states | See "The merge order, step by step" below |
| `pnpm knip` | `main` `b80bfc84` | **Exit 1**: `docs/superpowers/audits/builders-look-survey/shoot.mjs` is an unused file (finding 2) |
| `git merge-tree` of the whole order with `claude/shared-polish-build` | | Exit 0: no conflict; the shared files are `pnpm-lock.yaml` and `agents/automata/skills/automata-api/reference/api.md` |
| Reverting the letterbox's two commits on the whole order | a scratch worktree | Conflicts in `examples/3d/retrocrisp/retrocrisp-grade.ts` and `spikes/tll-extensions/shoot.mjs` (finding 12) |
| `readLevel` and `buildWorld` on `world-level-room`'s room, as it is and with `floor: 0, light: 1` | the trial, a throwaway unit test | As it is: 2 problems, 0 pieces, `buildWorld` says nothing; repaired: 0 problems, 6 pieces |

Not run: WebGPU, WebKit, Firefox, a real GPU; the 3D browser suites and the examples' journeys whole (only the plan's
new browser test was run); `pnpm build`, `api-report`, `api-index`; the builders' own renders (their committed frames
were used, as the plan intends).

## The measures, again

PENDING

## The merge order, step by step

PENDING

## Findings

Ranked: **blocking** (the plan as written fails its own gates or would make a builder change product code on a false
premise), **should fix** (a gap or a wrong fact a builder would hit), **tidy**. Each is fixed in the plan or the survey in
this branch unless it says **open**, with the reason and where it went.

PENDING

## The two calls left to this audit

PENDING

## For the coordinator

PENDING
