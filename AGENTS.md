# Automata Plus: Agent Rules

Automata Plus is the paid half of AutomataFramework (AF): extensions in `packages/`, and later kits, starters and
agent packs (PRODUCT spec §6). Core lives in the framework repository, `mcthaydt/automata-framework`.

## Read first

1. This file, then `README.md` for how core gets into this workspace.
2. The framework's `AGENTS.md`. Its rules apply here wherever they cover the work: the seven laws, the sim
   boundaries, Effect outside the sim only, Zod only, PixiJS only, the naming suffixes, cross-engine determinism and
   the testing rules. This file adds what is particular to Plus.
3. The plan for the task in the framework (`docs/superpowers/plans/`; this workspace's own is
   `2026-10-23-product5-plus-repo-and-physics-move.md`) and the PRODUCT spec
   (`docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md`). Record a task's execution log in `docs/` here.

## Paid and private

- Plus is paid and private. No Plus source, kit or package goes into the framework or into any public repository,
  issue, log, package or artifact.
- The license is `LICENSE`: all rights reserved, used under the Automata Plus commercial terms (the Owner's decision
  D-7). Every package manifest says `"license": "SEE LICENSE IN LICENSE"` (P5-D5). Never write license, pricing or
  terms text here that the Owner has not decided.
- A paid capability is never silently replaced by a weaker free path. When a Plus capability is unavailable it fails
  and says so; it does not fall back to a core or standalone path behind the player's back (the same rule as the
  framework's host authority).

## Core

- Core comes from the framework at the commit in `core.ref` until core is on a registry (P5-D1). `core.ref` holds one
  full commit and nothing else. `pnpm core:sync` fetches that commit into `.core/af`, builds it, packs it into
  `.core/packs` and writes the block between `# core-overrides:begin` and `# core-overrides:end` in
  `pnpm-workspace.yaml`. Never edit the block by hand.
- To move core: set `core.ref` to the new commit, run `pnpm core:sync` and `pnpm install`, and commit `core.ref`,
  `pnpm-workspace.yaml` and `pnpm-lock.yaml` together. On a fresh checkout, run `pnpm core:sync` before
  `pnpm install`.
- A Plus package imports core only through core's public entries (PRODUCT.1b enforces it with the F1 boundary test).
  It lists core under `peerDependencies` and never under `dependencies`; `devDependencies` may list core for the
  package's own tests (`tooling/core/manifest-rules.ts` enforces both rules).
- Core is the framework's. Never copy, patch or redefine a core contract here: anything core lacks goes to the
  framework as a request (one contract owner).

## Engineering

- **Strict TDD** in `packages/` and `tooling/`: write the failing test, run it and confirm it fails for the expected
  reason, then make the minimal change.
- Run `pnpm format`, then `pnpm check` (lint, typecheck, unit tests) before every commit.
- `tooling/core` runs before `pnpm install`, so it imports nothing but Node and its own files.

## CI

- CI runs on the Owner's own devices (label `af-mac`), never on GitHub's hosted runners. Every job carries the fork
  guard, so a fork's code never reaches the Owner's machine. `tooling/ci/workflows.test.ts` pins both.
- A workflow change needs the Owner's words, quoted in the PR.

## Secrets

- No secrets in the repository: no tokens, keys, `.env` files or credentials in code, config or tests. CI reads
  the framework with the Mac's own git credentials, and the workflow reads no secret.

## Git

- Conventional Commits. One branch, one PR. Nothing is pushed to `main` directly.
