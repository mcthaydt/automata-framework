# AutomataFramework: Agent Rules

## Read order and current task

Read these before choosing work:

1. `docs/00-overview.md`, then the Ruken-first master spec and extraction map it links.
2. `docs/01-decomposition.md` for packages, milestones, dependencies and required spec/plan detail.
3. `docs/02-master-delivery-plan.md`, the only task list.
4. `docs/03-continuation-prompt.md` for current evidence, unresolved inputs and the exact next action.
5. `docs/04-how-we-build.md` for how a task flows to a merged PR.

Then read the milestone spec, its ADR/spike references and the task's plan when one exists. `CLAUDE.md` delegates to this file.

**Current direction (Owner, 2026-10-11):** AF is **Ruken first**. Core packages are built from proven code in FloorFifty (2D), The Last Light (`PixiJS3D_Experiment_001`, 3D) and Ruken; everything else is an opt-in extension. PixiJS renders 2D and 3D (ADR 0002). Effect runs everything outside the sim; the sim stays on Koota and never imports Effect (ADRs 0001, 0003). Ruken's packages and process are the foundation (ADR 0004). CI/CD, deployment, mobile UI and the content compiler come first, in M1. AF 1.0 covers 2D and 3D, and the 3D runtime is free, not Plus (2.5D was dropped on 2026-10-18; **Owner, 2026-10-23: "3D ships 1.0"**, M3R-D10, M3R-D20): the base 3D game, `games/base-3d`, is built on AF inside 1.0 and its proven 3D systems become packages (M9) before the launch. Run CI locally (Node 24, Playwright browsers, all jobs including parity): hosted Actions jobs are not getting runners. Each milestone's spec is reviewed before its task plans; in M1, work runs in parallel lanes (`docs/04-how-we-build.md`), each writing its task spec first and getting it reviewed in its own PR. Decisions D-1 to D-6 run on their recommended defaults (master spec §12). Preserve the merged M0 work. **Owner, 2026-10-16:** loosen the Ruken coupling so a game publishes to Ruken or itch.io: Ruken stays the reference host and contract vocabulary, the target is chosen at build time, and itch.io is a supported target ([ADR 0005](docs/adr/0005-publish-targets.md), PUB spec; approved 2026-10-16). **Owner, 2026-10-16:** DX.0, PRODUCT.0, EX.0, QB.0 and PUB.0 are approved with every recommended default. **Owner, 2026-10-18:** drop 2.5D. **Owner, 2026-10-23:** "procedural only for now": rigged glTF characters are deferred (procedural figures with an IK rig for posing and animation), the 3D camera is Crow Country's angle on a 24 mm lens, 25° down and 5 m back, turned freely by the player; the Ocarina-style action-adventure is the base 3D game, the counterpart of Emberwick, with "everything we did for 2D" done for 3D, matching the 2D game's quality and authored in the editors; one question is open, how 3D ships publicly while `@pixi/3d` is a closed beta (M3R-D18) ([revised M3 spec](docs/superpowers/specs/2026-10-18-m3-3d-characters-design.md), awaiting review).

## Planning, tracking and handoff

- Every milestone spec defines scope, ownership, interfaces, ordered flows, lifecycle/failure/recovery behavior, dependencies and concrete success/failure acceptance cases. UI specs include component/state and responsive/input inventories; testing specs define fixtures, test layers, focused feedback and required full gates. Follow `docs/01-decomposition.md` §5.
- Plans name exact create/modify/test files and consumed/produced interfaces, with observable failing tests, minimal changes, passing verification and reviewable deliverables. A roadmap or draft spec does not authorize implementation.
- Maintain `docs/03-continuation-prompt.md` after changing the agreed plan, completing or blocking a task, recording verification and before every handoff/end of a work session. This is the agent's responsibility, not automatic synchronization.
- Update the master delivery checklist and applicable spec/plan status from evidence in the same session. Track drafted, reviewed, implemented, locally checked, CI verified, deployed and Owner accepted separately. Leave incomplete gates unchecked; historical results and unchecked plans are not proof of current implementation status.
- Verify existing artifacts before rebuilding them. Preserve unrelated changes and active processes; use isolation when work would conflict. Do not delegate unless explicitly requested or required by an applicable instruction.
- Write simple, readable code with descriptive names and small responsibilities. Use established patterns when they solve the current problem; explain non-obvious invariants, algorithms and failure policies beside the code.

## Contracts and scope

- **One contract owner.** Shared sim/content/snapshot/replay/host contracts have an explicit owner and consuming milestones. Keep definitions canonical; do not maintain slightly different copies in runtime, rendering, UI and networking. Coordinate changes in the owning spec and affected consumers before implementation. Breaking published changes require semver and the approved migration/codemod path.
- **Ruken first.** Ruken's contracts win: consume `@ruken/sdk`, `@ruken/sdk-host` (fake host), `@ruken/manifest` and `ruken publish` (which validates); never redefine or copy a Ruken message, capability, limit or manifest field. Anything Ruken lacks goes to Ruken as a request. Version pins follow Ruken's `docs/versions.md`. A bare `M1.4` in AF docs is AF's; write Ruken's as "Ruken M1".
- **Core and extensions.** Core is what Ruken requires of every game or what both reference games need; everything else is an extension registered with `defineExtension`. Extensions never edit core files; core never imports an extension. Extracted code comes from a recorded source commit and brings its source tests.
- **Honor host authority.** Use the `Hosting` service and the Ruken SDK. A denied/unavailable hosted capability must not silently switch to device storage or another standalone path. Adapter tests cover readiness, lifecycle, timeouts, consent and missing capabilities. Any adapter/harness window-message handler validates both source and origin; do not duplicate the SDK bridge in game code.
- **Keep the current task scoped.** Reconcile dependencies without pulling unrelated future features into implementation. Keep retained scope in its owning milestone; no speculative dependencies, generic abstractions or unrequested automation.
- **Facts come from evidence.** Generate metrics, hashes and validation results from actual artifacts/checks. Human review records decisions, not invented FPS, CI success, license facts or implementation status. Record asset provenance and verify outputs before claiming visual acceptance.

## Responsive UI

- Reuse framework primitives and theme/composition contracts rather than copying viewport fixes into every screen. Layout depends on container size and usable height; input mode is independent. The `ui` geometry owner is the single source of layout geometry. Design and test at phone sizes first. Keyboard/browser-bar changes must not unexpectedly reclassify or remount the screen.
- Preserve essential actions, state and focus through rotation, compact height and host/keyboard occlusion. Use declared scroll regions; do not shrink touch targets or hide required actions to make a screenshot fit. Keep 44 px touch targets and 48 px primary actions.
- Test component states and player interactions through DOM behavior tests, production CSS geometry through real-browser layout checks, and rendered composition through GPU/integration evidence. A snapshot cannot prove focus or hit testing; a fixture cannot prove a real host/game journey.
- Inspect actual expected/actual/diff images for visual changes. Explain intentional baseline changes and obtain required Owner visual acceptance; do not automatically promote new screenshots or update goldens to hide an unexplained regression. Sim hash mismatches must be investigated, never rebaselined per engine.

## Testing feedback and shared runs

- Start with the smallest relevant failing test and confirm its failure reason. Use injected clocks/timers and deterministic seeds/content. Browser checks wait on semantic readiness, fonts and completed state transitions rather than arbitrary sleeps.
- Focused tests come before broader CI/GPU runs. Batch verified fixes and avoid duplicate remote jobs for the same artifact/selection. Expand coverage for shared styles/contracts and unknown dependencies; always report selected, omitted and pending gates.
- Unit tests, typecheck and build run locally and in hosted CI. Lightweight renderer-free DOM component/browser checks may run locally. Heavy GPU, visual and E2E suites stay on the GPU runner chosen in M1 (D-5); performance probes require exclusive GPU access. Preserve mandatory cross-engine parity.
- Reuse a test build/server only after verifying its source/config/content identity and explicit ownership. Rebuild after relevant changes. Isolate ports, test data and artifacts per checkout/run; never silently test another worktree's server or stop a process you do not own.
- Preserve first-attempt failure evidence even if a retry passes. Diagnose product assertions separately from runner/transport/setup failures. A skipped, empty or focused suite does not establish a required full gate.
- Mark plan steps when their required checks pass, in the same session. Record deviations with the supporting evidence; keep Progress/execution records and the continuation consistent. Do not collect all checkoffs at the end or treat an unverified workaround as completion.
- Preserve unrelated dirty work. Do not use a shared Git stash to hide another task's changes. Clean up only owned, verified disposable resources; removal of other worktrees or evidence requires explicit authorization.

## Engineering rules

- **Strict TDD** in `packages/`, `tooling/` and `examples/`: write a failing test first, then make the minimal change. `spikes/` is exempt (A0+A1 spec §2).
- **The seven laws** (2026-10-01 master spec §2, law 7 refined in the 2026-10-11 spec): only the sim changes gameplay state; the sim has no I/O, no wall clock and no `Math.random`; the host is a port and Ruken is the reference host.
- **Effect outside the sim only** (ADR 0003): runtime managers are Effect services; inject time through Effect's `Clock` and test it with `TestClock`; use `Scope` for disposal; no Effect allocation per frame. Zod is the only schema language.
- **PixiJS only** (ADR 0002): core 2D in `render-pixi`; 3D only in the `render-pixi3d` extension. WebGL2 is the default renderer and WebGPU is opt-in; every game imports `render-pixi/no-eval` first (Ruken's CSP has no `eval`). Filters are GLSL + WGSL pairs taking pixel position from the vertex stage; WebGL2 stays at parity with WebGPU. `render-pixi3d` stays unpublished (D-1).
- **Naming:** role suffixes (`*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.content.ts`, `*.generator.ts`, `*.extension.ts`, `*.test.ts`). Folders group by feature.
- **Determinism is cross-engine:** goldens must match bit-for-bit in Node, Chromium, WebKit and Firefox. Never accept a hash mismatch as "flaky".
- Run `pnpm format` before committing. Use Conventional Commits.
- Packages publish as `@mcthaydt/automata-<name>` (GitHub Packages, `mcthaydt/automata-framework`).
- **Before committing:** `pnpm check` runs lint, typecheck, `boundaries`, `style`, `knip` (unused files, exports and dependencies) and unit tests. CI runs the same, plus the cross-engine parity suites in Chromium, WebKit and Firefox and, after `pnpm build`, `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`, `changeset status` and `check-changesets`: after changing a published package's exports or doc comments, run `pnpm api-report --update` and `pnpm agent-skills --write` (and `pnpm cheatsheet` when `api-index` says the cheatsheet is stale) and commit what they write. Only published packages go in a changeset: a private one (render-pixi, game, the umbrella, cli) needs none, and naming one fails `check-changesets`.
- **`pnpm boundaries`** (packages/sim): no DOM/host globals, no `Date`/timers/`console`, only `Math.{sqrt,fround,round,floor,ceil,trunc,abs,min,max,sign,imul}` (use `@mcthaydt/automata-sim/math` for the rest), no `**`, no `Object.keys/values/entries`/`for…in` (use `sortedKeys`/`sortedEntries`), imports only from `koota`, `zod`, Rapier deterministic-compat, or relative paths (so never `effect`).
- **`pnpm style`**: kebab-case files; `define*` results live in a file with the matching role suffix (`*.component.ts` exports `defineComponent` results, and so on); `testing/` folders and tests are exempt. A non-test `.ts` source file under `packages/*/src` has at most 600 lines: split it by responsibility.
- Heavy GPU, visual and E2E suites run on the GPU runner (from M1.1), not on the developer's Mac.
