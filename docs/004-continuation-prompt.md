# AutomataFramework: living continuation

> Updated 2026-10-05. Source HEAD verified before this documentation update: `3554f94`. This file is a handoff snapshot, not proof of current CI, deployment or full project acceptance. Agents maintain it at every handoff.

## Prompt for the next agent

Continue in `/Users/mcthaydt/Desktop/Business/McThayDT/AutomataFramework`. Read `AGENTS.md`, [001 Overview](001-overview.md), the linked master architecture, [002 Decomposition](002-decomposition.md), [003 Master delivery plan](003-master-delivery-plan.md) and this file. Then read the applicable phase/reference specs. Preserve unrelated work and active processes.

**Owner direction:** first produce a complete detailed spec set for all A/B phases, matching Ruken's Superpowers planning. Implementation plans remain just-in-time, after written-spec review. Carry FloorFifty's responsive UI learnings into shared components and dramatically improve test feedback and diagnosis. Keep those requirements in the existing phase decomposition; no separate UI/testing workstream. Delivery order is A+B, then a real 3D game, then C modules extracted from FloorFifty (2D) and the 3D game. The former C1–C8 template-port scope is removed; future game/C specs do not block the current A/B spec pass.

## Exact next action

**Current task: SPEC-01 — reconcile the existing master and A0+A1 design.**

1. Read the master architecture, A0+A1 §§11–12, ADR 0001, S1–S6 and public sim/checker source. Read current Ruken P1 and the S6 answers before treating host contracts as settled.
2. Identify remaining A1b physics/content and A1c testing/example/build/publishing contracts. Preserve merged A0/A1a work; historical green and unchecked plan steps are not present acceptance evidence.
3. Reconcile the approved responsive UI/testing requirements and state/contract ownership into the existing spec/decomposition. Record concrete unresolved design inputs and requirement coverage.
4. Mark SPEC-01 only after its reconciliation artifact and self-review exist. Then proceed through SPEC-02–SPEC-11 to create the 10 missing A/B phase specs, followed by SPEC-12 consistency audit and SPEC-13 Owner written-spec review.

**Do not start an A1b implementation plan or product changes before SPEC-13.** Do not prewrite all implementation plans. Do not treat the numbered-doc setup as completion of SPEC-01.

## Current artifacts and evidence limits

| Artifact / work | Evidence recorded | What remains |
|---|---|---|
| A0 and A1a | Historical merged PR #1/#2 and October 2 checks in the decomposition; source exists | Current remote CI/acceptance not refreshed in this documentation session. Remaining A1 scope is open. |
| Responsive UI/test-feedback direction | Commit `3554f94`, master overview and decomposition | Phase implementation has not begun; full detailed specs are the new next task. |
| Numbered documentation and expanded agent rules | This update: `AGENTS.md`, 001–004, forwarding decomposition and both existing spec read-order/planning references; relative links, 13 unique SPEC tasks, all 10 missing A/B phases and startup/CLAUDE delegation checked | Included in the documentation commit requested by Owner; obtain its hash from Git history. No missing phase spec is claimed written or approved. |
| Checks for this documentation update | `pnpm format`, `git diff --check`, document link/coverage/status checks and `pnpm check` passed; typecheck/unit tasks used Turbo cache; boundaries/style reported zero findings | No browser/GPU/deployment gate was run here. Re-run appropriate checks after subsequent edits. |

The main checkout was verified on branch `main` at `3554f94`; Git listed no linked worktrees. Refresh status before starting edits. Previous missing package links were restored with `pnpm install --frozen-lockfile --offline`; no dependency version change was made.

## External inputs and unresolved gates

- Reconcile Ruken's current P1 contract with S6's answers; verify actual SDK publication/freeze state rather than assuming readiness from October 16.
- Read real source asset/editor contracts for B1/B2. After A/B delivery, select and review a real 3D game design. C modules are selected only after auditing demonstrated FloorFifty and 3D-game behavior; there is no replacement module catalog yet.
- GitHub Packages publishing/game-reader credentials, Linux GPU hardware, Cloudflare/Hetzner/Neon accounts and domains remain relevant phase dependencies; their readiness is not verified here.
- Concrete timing budgets require measured queue/setup/execution evidence when A3 infrastructure exists. Required Node/Chromium/WebKit/Firefox hash parity cannot be traded for speed.
- Written-spec review, future TDD plan review/execution selection, runtime/device evidence and Owner visual acceptance remain separate gates.

## Maintenance checklist

Update this one canonical snapshot after task completion/blockage, agreed-plan changes, verification and before each handoff/end of a session:

1. Record the date and actually verified source HEAD. Never invent a commit for the update itself.
2. Record completed task IDs, scoped artifacts/commits and actual evidence. Distinguish draft, review, implementation, local checks, CI, deployment and Owner acceptance.
3. Keep one exact next task, its prerequisites and first concrete action. List external/Owner decisions separately.
4. Keep incomplete gates unchecked in the master plan and relevant phase documents; state what remains without rebuilding existing work blindly.
5. Record unfinished edits and check failures; preserve unrelated work and approved scope. Remove resolved blockers and obsolete next steps.
6. Verify relative links, task IDs, coverage and status consistency. When a commit is requested, include this update with the scoped work and report the actual commit afterward.
