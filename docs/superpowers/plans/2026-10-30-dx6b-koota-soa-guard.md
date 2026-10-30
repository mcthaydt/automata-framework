# DX.6b: a `check-boundaries` rule against koota struct-of-arrays code generation, TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6 (`automata check`: the `boundaries` and `no-eval` steps); the A0+A1 spec §3.3 (the checker works on the AST). Source of the task: the DX.6 follow-up "koota SoA code generation" (02, found 2026-10-16), and `packages/cli/src/check/no-eval-allowlist.ts`, which says a direct `trait({ ... })` call is caught only by the opt-in `--csp` step.
- **Task:** `DX.6b — Guard against koota struct-of-arrays code generation in sim code`. Lane DX.
- **Status:** drafted 2026-10-30, based on `main` (`b7ef19d9`).
- **Progress:** 0 of 5 steps.

## What is wrong

koota 0.6.6's `trait(schema)` picks a storage layout from its argument (`dist/chunk-ZWIGMIL4.js`, `createTrait`): a function is an array-of-structures (AoS) factory, an empty object (or nothing) is a tag, and any other object is a struct-of-arrays (SoA) schema, whose `set`, `fastSet`, `fastSetWithChangeDetection` and `get` accessors koota compiles with `new Function` (`createSoA*Function`). Ruken serves games under a CSP with no `'unsafe-eval'`, so an SoA trait throws an `EvalError` when it is created. `relation({ store })` passes its `store` to `trait`, so an object store does the same. AF's `defineComponent` makes AoS traits (`packages/sim/src/define/definitions.ts`, pinned by `packages/sim/src/world/no-eval.test.ts`), and the `no-eval` scan allowlists koota's generators because AF never reaches them. Nothing stops a game's sim from calling `trait({ x: 0 })` itself: the scan passes it, and only `automata check --csp` fails it, and only when the trait is created at boot.

## Decisions

- **One new rule, `koota-soa`,** in `tooling/check-boundaries/src/check.ts`, with a message that names the fix (`defineComponent`, or a factory: `trait(() => ({ ... }))`, `relation({ store: () => ({ ... }) })`).
- **Which calls are koota's:** the local names a `koota` value import binds to `trait` and `relation` (aliases included) and members of a namespace import (`koota.trait`, `koota['trait']`). A sim may import only `koota`, `zod`, Rapier, the sim's entries and relative files, so another function called `trait` is the game's own and is not checked. Not covered: koota's `trait` passed around as a value (`const t = trait`) or re-exported through a relative module; the `--csp` step stays the backstop for those (noted beside the code).
- **What a schema may be:** nothing or `{}` (a tag), or an inline arrow or function expression (an AoS factory). An object literal with any property (a spread included) is SoA and is reported. Any other expression (`trait(schema)`, `trait(make())`) is reported too, because the checker cannot see whether it is an object; this follows the checker's existing stance (`Object[...]` needs a literal member name, a dynamic import a literal specifier). The same rules apply to a relation's `store`; a relation definition that is not an object literal, or holds a spread or a computed key, is reported for the same reason.
- **Relations are included.** The brief names `trait(...)`; `relation({ store: { ... } })` reaches the same `new Function` through `trait`, so leaving it out would leave the same CSP bug one call away. Recorded for the Owner's veto.
- **Inline mode checks koota calls in the whole file.** `--inline` (one-file examples) normally checks only the arguments of `defineSystem` and `definePlugin`, because file-level code is browser code. The CSP covers the whole page, and components are defined at file level, so `koota-soa` applies to every call in an inline file. Recorded for the Owner's veto.
- **Existing sim code:** every root the root `boundaries` script checks is run with the rule. Only `packages/sim/src/define/definitions.ts` imports `trait`, and it passes a factory, so no CSP bug is expected; if a root trips the rule, that code is fixed test-first in this task.
- **Published package:** `@mcthaydt/automata-check-boundaries` gets a patch changeset. It has no API report (the reports cover `packages/*`); its exported `Rule` union gains `'koota-soa'`.
- **Docs that list the rules:** `agents/automata/skills/automata-verify/SKILL.md` documents every rule (its test reads the `Rule` union), the DX spec §3.6 `boundaries` row, and the comment in `packages/cli/src/check/no-eval-allowlist.ts` that names this gap. AGENTS.md's `pnpm boundaries` bullet and 02's DX.6 follow-up belong to the integration owner (follow-ups in the PR).

## Files

- **Create:** `tooling/check-boundaries/fixtures/koota-object-schema.ts`, `koota-aliased.ts`, `koota-namespace.ts`, `koota-schema-variable.ts`, `koota-relation-store.ts`, `koota-factory.ts` (clean), `koota-unrelated.ts` (clean), `fixtures/inline/koota-file-level.ts`; `.changeset/dx6b-koota-soa-guard.md`.
- **Modify:** `tooling/check-boundaries/src/check.ts`, `tooling/check-boundaries/src/check.test.ts`; `agents/automata/skills/automata-verify/SKILL.md`; `docs/superpowers/specs/2026-10-16-dx-small-games-ai-native-design.md` (§3.6 row); `packages/cli/src/check/no-eval-allowlist.ts` (comment only); this plan.

## Interfaces

- Consumed: koota 0.6.6's `trait(schema?)` and `relation(definition?)` semantics (above); the oxc-parser ESTree AST the checker already walks.
- Produced: `Rule` in `@mcthaydt/automata-check-boundaries` gains `'koota-soa'`. A finding line keeps the CLI's format (`file:line:col  koota-soa  message`), which `packages/cli`'s `tool-output.ts` already parses, so `automata check` reports it with no change.

## Steps

- [ ] **1. Red: fixtures and tests first.** Add the fixtures and, in `check.test.ts`: each failing fixture reports exactly one `koota-soa` finding at the schema argument (`[rule, line, col]`), the message names the fix, the two clean fixtures report nothing, and inline mode reports the file-level `trait({ ... })` and nothing else in that file. Run `pnpm --filter @mcthaydt/automata-check-boundaries test -- src/check.test.ts`: the new failing-fixture cases fail with `[]` instead of the finding (no rule yet); the clean ones pass.
- [ ] **2. Green.** Collect the `koota` bindings from the module's imports, check `trait` and `relation` calls in `visit` and, in inline mode, in the file-level walk. The focused file passes; the existing 40-odd cases still pass.
- [ ] **3. Every root.** `pnpm boundaries` with the rule: every root the script names, 0 findings expected. A planted `trait({ x: 0 })` in a copy of a game sim (scratch folder, never committed) fails `automata-check-boundaries` with exit 1 and the `koota-soa` line; the same through `automata check --sim-only --json` shows the finding in the `boundaries` step.
- [ ] **4. Docs and changeset.** The `automata-verify` row (its `documents rule koota-soa` case is red until the row lands), the DX spec §3.6 row, the allowlist comment, the changeset.
- [ ] **5. Gates and hand-off.** `pnpm format`; `TURBO_FORCE=true pnpm check`; `pnpm build`; `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills` (expected current: no `packages/*` export changes); `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts`. Draft PR.

## Gates

- Selected: the focused check-boundaries tests, `pnpm boundaries`, the planted-trait CLI runs, `TURBO_FORCE=true pnpm check`, `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`, changeset status and `check-changesets`.
- Omitted: parity (no sim, renderer, `ui` or golden change: the sim's sources are only read by the checker), e2e and example builds (no example or game changes), consumer smoke (no build-config change).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | Plan | | |
