# AutomataFramework: Agent Rules

## Read order and current task

Read these before choosing work:

1. `docs/001-overview.md`, then the approved master architecture spec it links.
2. `docs/002-decomposition.md` for phase ownership, dependencies and required planning detail.
3. `docs/003-master-delivery-plan.md` for ordered tasks and gates.
4. `docs/004-continuation-prompt.md` for current evidence, unresolved inputs and the exact next action.

Then read the applicable phase spec, its ADR/spike references and its implementation plan when one exists. `CLAUDE.md` delegates to this file.

**Current direction:** complete specs for A and B, at Ruken's Superpowers level of detail, before writing the next implementation plan or making product changes. Preserve completed A0/A1a work. Implementation plans are written just before execution, after the complete spec set and cross-phase contracts have been reviewed. Then build a real 3D game using A and B, with its own reviewed design and TDD plans. Part C comes afterward: select and extract reusable modules from demonstrated FloorFifty (2D) and 3D-game behavior. The former C1–C8 template-port inventory is removed. Do not invent C's module inventory or require future C specs before A/B implementation; keep game-specific behavior in its game until reuse is justified.

## Planning, tracking and handoff

- Every phase spec defines scope, ownership, interfaces, ordered flows, lifecycle/failure/recovery behavior, dependencies and concrete success/failure acceptance cases. UI specs include component/state and responsive/input inventories; testing specs define fixtures, test layers, focused feedback and required full gates. Follow `docs/002-decomposition.md` §3.1.
- Plans name exact create/modify/test files and consumed/produced interfaces, with observable failing tests, minimal changes, passing verification and reviewable deliverables. A roadmap or draft spec does not authorize implementation.
- Maintain `docs/004-continuation-prompt.md` after changing the agreed plan, completing or blocking a task, recording verification and before every handoff/end of a work session. This is the agent's responsibility, not automatic synchronization.
- Update the master delivery checklist and applicable spec/plan status from evidence in the same session. Track drafted, reviewed, implemented, locally checked, CI verified, deployed and Owner accepted separately. Leave incomplete gates unchecked; historical results and unchecked plans are not proof of current implementation status.
- Verify existing artifacts before rebuilding them. Preserve unrelated changes and active processes; use isolation when work would conflict. Do not delegate unless explicitly requested or required by an applicable instruction.
- Write simple, readable code with descriptive names and small responsibilities. Use established patterns when they solve the current problem; explain non-obvious invariants, algorithms and failure policies beside the code.

## Contracts and scope

- **One contract owner.** Shared sim/content/snapshot/replay/host contracts have an explicit owner and consuming phases. Keep definitions canonical; do not maintain slightly different copies in runtime, rendering, UI and networking. Coordinate changes in the owning spec and affected consumers before implementation. Breaking published changes require semver and the approved migration/codemod path.
- **Honor host authority.** Use the `Hosting` port and the Ruken SDK. A denied/unavailable hosted capability must not silently switch to device storage or another standalone path. Adapter tests cover readiness, lifecycle, timeouts, consent and missing capabilities. Any adapter/harness window-message handler validates both source and origin; do not duplicate the SDK bridge in game code.
- **Keep the current task scoped.** Reconcile dependencies without pulling unrelated future features into implementation. Keep retained scope in its owning phase; no speculative dependencies, generic abstractions or unrequested automation.
- **Facts come from evidence.** Generate metrics, hashes and validation results from actual artifacts/checks. Human review records decisions, not invented FPS, CI success, license facts or implementation status. Record asset provenance and verify outputs before claiming visual acceptance.

## Responsive UI

- Reuse framework primitives and theme/composition contracts rather than copying viewport fixes into every screen. Layout depends on container size and usable height; input mode is independent. Runtime Display owns shared geometry. Keyboard/browser-bar changes must not unexpectedly reclassify or remount the screen.
- Preserve essential actions, state and focus through rotation, compact height and host/keyboard occlusion. Use declared scroll regions; do not shrink touch targets or hide required actions to make a screenshot fit. Keep 44 px touch targets and 48 px primary actions.
- Test component states and player interactions through DOM behavior tests, production CSS geometry through real-browser layout checks, and rendered composition through GPU/integration evidence. A snapshot cannot prove focus or hit testing; a fixture cannot prove a real host/game journey.
- Inspect actual expected/actual/diff images for visual changes. Explain intentional baseline changes and obtain required Owner visual acceptance; do not automatically promote new screenshots or update goldens to hide an unexplained regression. Sim hash mismatches must be investigated, never rebaselined per engine.

## Testing feedback and shared runs

- Start with the smallest relevant failing test and confirm its failure reason. Use injected clocks/timers and deterministic seeds/content. Browser checks wait on semantic readiness, fonts and completed state transitions rather than arbitrary sleeps.
- Focused tests come before broader CI/GPU runs. Batch verified fixes and avoid duplicate remote jobs for the same artifact/selection. Expand coverage for shared styles/contracts and unknown dependencies; always report selected, omitted and pending gates.
- Unit tests, typecheck and build run locally and in hosted CI. Lightweight renderer-free DOM component/browser checks may run locally. Heavy GPU, visual and E2E suites stay on the Linux GPU runner; performance probes require exclusive GPU access. Preserve mandatory cross-engine parity.
- Reuse a test build/server only after verifying its source/config/content identity and explicit ownership. Rebuild after relevant changes. Isolate ports, test data and artifacts per checkout/run; never silently test another worktree's server or stop a process you do not own.
- Preserve first-attempt failure evidence even if a retry passes. Diagnose product assertions separately from runner/transport/setup failures. A skipped, empty or focused suite does not establish a required full gate.
- Mark plan steps when their required checks pass, in the same session. Record deviations with the supporting evidence; keep Progress/execution records and the continuation consistent. Do not collect all checkoffs at the end or treat an unverified workaround as completion.
- Preserve unrelated dirty work. Do not use a shared Git stash to hide another task's changes. Clean up only owned, verified disposable resources; removal of other worktrees or evidence requires explicit authorization.

## Engineering rules

- **Strict TDD** in `packages/`, `tooling/` and `examples/`: write a failing test first, then make the minimal change. `spikes/` is exempt (A0+A1 spec §2).
- **The seven laws** (overview spec §2): only the sim changes gameplay state; the sim has no I/O, no wall clock and no `Math.random`; the host is a port.
- **Naming:** role suffixes (`*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.test.ts`). Folders group by feature.
- **Determinism is cross-engine:** goldens must match bit-for-bit in Node, Chromium, WebKit and Firefox. Never accept a hash mismatch as "flaky".
- Run `pnpm format` before committing. Use Conventional Commits.
- Packages publish as `@mcthaydt/automata-<name>` (GitHub Packages, `mcthaydt/automata-framework`).
- **Before committing:** `pnpm check` runs lint, typecheck, `boundaries`, `style` and unit tests (CI runs the same, plus the cross-engine parity suites in Chromium, WebKit and Firefox).
- **`pnpm boundaries`** (packages/sim): no DOM/host globals, no `Date`/timers/`console`, only `Math.{sqrt,fround,round,floor,ceil,trunc,abs,min,max,sign,imul}` (use `@mcthaydt/automata-sim/math` for the rest), no `**`, no `Object.keys/values/entries`/`for…in` (use `sortedKeys`/`sortedEntries`), imports only from `koota`, `zod`, Rapier deterministic-compat, or relative paths.
- **`pnpm style`**: kebab-case files; `define*` results live in a file with the matching role suffix (`*.component.ts` exports `defineComponent` results, and so on); `testing/` folders and tests are exempt.
- Heavy GPU, visual and E2E suites run on the Linux GPU runner (from A3), not on the developer's Mac.
