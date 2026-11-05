# Refactor progress

**Overall: 13% (3 of 24 stages done).**

The Owner's order (2026-11-05): finish one area completely before starting the next, in this order:
core and 2D, then 3D, then the editors, then the website. Each stage runs in its own session.

Every area goes through the same six stages:

1. **Audit** (Opus, extra-high effort): what is there, measured.
2. **Plan and spec** (Opus, medium, with the superpowers plugin).
3. **Plan audit** (Opus, medium).
4. **Build** (Sonnet, high), updating this page as each step lands.
5. **Build audit** (Opus, medium): complete, consistent, matches the spec and the codebase.
6. **Fixes** (Sonnet, high): every finding from stage 5 closed.

Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and how to use it?

## Core and 2D: 50% (3 of 6)

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-05; the Owner took all four decisions (D1 to D4) the same day | [2026-11-05-core-and-2d-audit.md](2026-11-05-core-and-2d-audit.md) |
| 2. Plan and spec | Done, 2026-11-05 | [spec](2026-11-05-core-and-2d-spec.md), [plan](2026-11-05-core-and-2d-plan.md) |
| 3. Plan audit | Done, 2026-11-05: 31 findings, all fixed in the spec and plan; three calls left for the Owner | [plan audit](2026-11-05-core-and-2d-plan-audit.md) |
| 4. Build | In progress: phase 1 done locally, PR #388 | [plan](2026-11-05-core-and-2d-plan.md) |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

### Build: 13% (4 of 30 tasks)

Stage 4 ticks these off as it goes; the [plan](2026-11-05-core-and-2d-plan.md) has the steps.

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 Per-area Playwright configs | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.2 The pull request gate | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.3 Frame budget skips on a software renderer | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.4 `.vscode` | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 2.1 Tag the starting point | 2 | Not started | |
| 2.2 Emberwick's stand-ins | 2 | Not started | |
| 2.3 The placeholder game | 2 | Not started | |
| 2.4 Features no game uses | 2 | Not started | |
| 3.1 The Vitest preset | 3 | Not started | |
| 3.2 The test move codemod | 3 | Not started | |
| 3.3 Move tests, package by package | 3 | Not started | |
| 4.1 The boundaries rules | 4 | Not started | |
| 4.2 The move map and import codemod | 4 | Not started | |
| 4.3 Build `packages/automata` | 4 | Not started | |
| 4.4 `tools`, and `sim` and `content` inside | 4 | Not started | |
| 5.1 Bundle report, before | 5 | Not started | |
| 5.2 Plain-TypeScript helpers | 5 | Not started | |
| 5.3 Host contract and targets | 5 | Not started | |
| 5.4 Runtime features and the app | 5 | Not started | |
| 6.1 Emberwick is Emberwick | 6 | Not started | |
| 6.2 Emberwick imports one package | 6 | Not started | |
| 6.3 Emberwick by feature | 6 | Not started | |
| 6.4 The surface | 6 | Not started | |
| 7.1 Docs and AGENTS.md | 7 | Not started | |
| 7.2 Comments that cite plans | 7 | Not started | |
| 8.1 The copy table | 8 | Not started | |
| 8.2 New Emberwick journeys | 8 | Not started | |
| 8.3 The `create-game` journey | 8 | Not started | |
| 9.1 Prepare the branch clean-up | 9 | Not started | |
| 9.2 Run it (the Owner's go) | 9 | Not started | |

Done means: Emberwick's journeys pass on every pull request in two browsers, the Owner plays it on the iPad, the
repository has only `main` and branches with active CI (fewer than 5), the code follows the feature-folder layout
with tests in their own folder, and `.vscode` hides what the Owner does not need to see.

## 3D: 0% (0 of 6)

Not started. Starts when core and 2D are done.

## Editors: 0% (0 of 6)

Not started. Starts when 3D is done.

## Website: 0% (0 of 6)

Not started. Starts when the editors are done.
