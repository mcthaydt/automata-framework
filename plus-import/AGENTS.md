# Automata Plus: Agent Rules

Automata Plus is AutomataFramework's (AF's) optional half: extensions in `packages/`, and later kits, starters and
agent packs (PRODUCT spec §6). Core lives in the framework repository, `mcthaydt/automata-framework`. Plus is free and
MIT licensed, like the framework (the Owner, 2026-11-01: "The only thing people have to pay for is the editors on
mobile"; "MIT, mobile app wrapper code in a private repo").

## Read first

1. This file, then `README.md` for how core gets into this workspace.
2. The framework's `AGENTS.md`. Its rules apply here wherever they cover the work: the seven laws, the sim
   boundaries, Effect outside the sim only, Zod only, PixiJS only, the naming suffixes, cross-engine determinism and
   the testing rules. This file adds what is particular to Plus.
3. The plan for the task in the framework (`docs/superpowers/plans/`; this workspace's own is
   `2026-10-23-product5-plus-repo-and-physics-move.md`) and the PRODUCT spec
   (`docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md`). Record a task's execution log in `docs/` here.

## Licence and what is paid

- Plus is MIT licensed (`LICENSE`, copyright Team Automata), and every package manifest says `"license": "MIT"`
  (`tooling/core/manifest-rules.ts` enforces it). This replaces the earlier commercial terms (D-7, P5-D5).
- The only paid product is the editor apps on iOS and Android. Their native wrapper code, signing setup and store
  listings live in a separate private repository, never here or in the framework.
- An extension that is unavailable fails and says so; it never falls back to a weaker core or standalone path behind
  the player's back (the same rule as the framework's host authority).

## Core

- Core comes from the framework at the commit in `core.ref` until core is on a registry (P5-D1). `core.ref` holds one
  full commit and nothing else. `pnpm core:sync` fetches that commit into `.core/af`, builds it, packs it into
  `.core/packs` and writes the block between `# core-overrides:begin` and `# core-overrides:end` in
  `pnpm-workspace.yaml`. Never edit the block by hand.
- To move core: set `core.ref` to the new commit, run `pnpm core:sync` and `pnpm install`, and commit `core.ref`,
  `pnpm-workspace.yaml` and `pnpm-lock.yaml` together. On a fresh checkout, run `pnpm core:sync` before
  `pnpm install`.
- A Plus package imports core only through core's public entries (PRODUCT.1b1 will enforce it with the F1 boundary
  test, which is not built yet). It lists core under `peerDependencies` and never under `dependencies`;
  `devDependencies` may list core for the package's own tests (`tooling/core/manifest-rules.ts` enforces both rules).
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
