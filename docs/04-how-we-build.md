# How we build AutomataFramework

AF follows Ruken's way of working (Ruken's [`docs/04-how-we-build.md`](https://github.com/mcthaydt/RukenApp/blob/main/docs/04-how-we-build.md)), scaled to one framework repo. `AGENTS.md` has the full rules.

## The short version

- **One plan.** [02 Master delivery plan](02-master-delivery-plan.md) is the only task list. Every piece of work has a task ID (M1.4, M2.3 …).
- **One status page.** [03 Continuation](03-continuation-prompt.md) says what is happening now, what is blocked and what the Owner needs to decide.
- **Specs per milestone.** A milestone starts with its spec. The Owner's review freezes that milestone's contracts; after that they change only additively or through a written change request.
- **Plans per task, just in time.** Each task gets a TDD plan in `docs/superpowers/plans/` before its code.
- **Every change is a pull request** whose title starts with the task ID. Nothing is pushed to `main`.
- **Nothing is done on an agent's word.** Done means tests pass, CI is green, and where the plan says so the Owner has looked and accepted.

## Ruken first

- Ruken's contracts win. AF consumes `@ruken/sdk`, `@ruken/sdk-host`, `@ruken/manifest`, Ruken's validation and `ruken publish` (ADR 0004). When AF needs something Ruken lacks, it goes to Ruken as a request; AF does not extend the protocol itself.
- Version pins follow Ruken's `docs/versions.md`.
- Ruken's milestone IDs (M1, M2 …) and AF's look alike. In AF documents, a bare `M1.4` is AF's; Ruken's are always written "Ruken M1".

## Core and extensions

- Core is what Ruken requires of every game or what both reference games need. Everything else is an extension registered with `defineExtension` (master spec §5).
- An extension never edits a core file; core never imports an extension.
- Extracted code comes from a recorded source commit and brings its source tests with it ([extraction map](superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md)).

## How a task flows

1. **Pick** the next unblocked task in the master plan (its prerequisites done, its milestone spec reviewed).
2. **Plan** it in `docs/superpowers/plans/`: exact files, interfaces, failing tests first, commands and expected results.
3. **Build** on its own branch in its own worktree. Strict TDD in `packages/`, `tooling/` and `examples/`.
4. **PR** with the task ID first in the title; CI green.
5. **Review and merge.** Anything needing the Owner's eyes (UI states, screenshots, copy) is flagged in the PR and on the status page.
6. **Record** the evidence in the master plan's execution record and update the continuation.
