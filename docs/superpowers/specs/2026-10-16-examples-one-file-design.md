# EX: one file per example, like raylib

> **Status:** reviewed. Drafted 2026-10-16; **approved by the Owner on 2026-10-16** with EX-D1 and EX-D2 (§9). The TDD plan is [`2026-10-16-examples-one-file.md`](../plans/2026-10-16-examples-one-file.md).
>
> **Why (Owner, 2026-10-16):** "the examples: they're kinda shit, how can we get it where each example is just one file like raylib?"

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| AF `examples/` | `5d54594` | Measured cost of today's demos (§1, appendix A) |
| [raylib examples](https://www.raylib.com/examples.html) and `raysan5/raylib` `examples/` | — | The target shape: `examples/<module>/<module>_<name>.c`, a header block, a difficulty rating, a screenshot beside it, one build for all, a site that plays each beside its source; full games live separately (raylib-games) |
| [DX spec](./2026-10-16-dx-small-games-ai-native-design.md) §3.1, §3.4 | — | `startGame`/`defineGame`, `rect`/`sprite`: the verbs the examples need |
| [PRODUCT spec](./2026-10-16-product-core-and-plus-design.md) §6, §7 | — | The umbrella import `@mcthaydt/automata`, the core/Plus tiers, the raylib module map |

## 1. The problem, measured

A demo today is a whole Vite app on top of a 77-file game:

| Demo | Files | Non-test source lines |
|---|---|---|
| `physics/bodies-2d` | 28 | 664 |
| `runtime/boot-and-flow` | 30 | 688 |
| `content/hot-reload` | 24 | 274 |
| `ui/primitives` | 13 | 478 |
| `host/lifecycle-and-saves` | 11 | 301 |
| `render-pixi/renderer-2d` | 9 | 228 |
| `base-2d` (Emberwick, which the demos build on) | 77 | 3,202 |

- **Boilerplate in every demo:** `index.html`, `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `ship.config.ts`, `env.d.ts` and `e2e/origin.ts`. The last is wired into `playwright.config.ts` by hand, one import per demo.
- **Plumbing before the feature.** `examples/physics/bodies-2d/main.ts` is 108 lines that hand-wire `makeHosting`, an `Effect` scope, `bootPage`, DOM queries, a touch button and the base's `playRoom`. The physics itself is in four more files.
- **Coupling.** Demos import Emberwick's internals (`@af-examples/base-2d/play`, `/render`, `/sim`), so a reader learns Emberwick before the feature, and an Emberwick change can break every demo.

raylib's equivalent is one file of 50–150 lines that reads top to bottom.

## 2. The shape of an example

- **Path:** `examples/<module>/<module>-<name>.ts`, for example `examples/core/core-input-keys.ts`. raylib's `core_input_keys.c` in kebab-case, which `pnpm style` requires.
- **Modules** (raylib's, mapped in the PRODUCT spec §7):
  - core: `core`, `shapes`, `textures`, `text`, `audio`, `render`, `sim`, `content`, `ui`;
  - Plus: `physics`, `net`, `feel`, `post`. These live in `mcthaydt/automata-plus` (PRODUCT.5) with the same runner and rules.
- **One code file:** it ends in `export default defineGame({...})`.
  - The runner calls `startGame` on it; a reader copies it into a game and calls `startGame(example)`.
  - Sim definitions (`defineComponent`, `defineCommand`, `defineSystem`, `definePlugin`) sit in the same file, unexported. The role-suffix rule in `tooling/check-style/src/style.ts` covers exported `define*` results only, so it doesn't fire.
- **Public imports only:** `@mcthaydt/automata` (the core umbrella, PRODUCT.2), `zod` or an extension's published entry. Never a relative import, another example, a game, or a core package's own entry (`@mcthaydt/automata-game`, `-sim` and the rest are reached through the umbrella; EX.6). `zod` stays a public import because every command takes a Zod schema and a game writes the same import; the umbrella does not re-export `z`, which would tie an example's schema library to the umbrella's pinned copy. A verb the umbrella lacks makes the example `Pending:` on the task that adds it.
- **Data lives in `examples/resources/`,** as in raylib:
  - shared art (Endesga 64 sprites with `PROVENANCE.md`);
  - TOML content (for example `resources/content/hot-reload/room.toml`);
  - fonts.

  Code never lives there.
- **Header:** a comment block before the first import, parsed by the catalog test (§5).

  | Field | Required | Example |
  |---|---|---|
  | Title line | yes | `// core-input-keys: move a square with the keyboard` |
  | `Shows:` | yes | `keys() turns keys into one sim command per tick; rect() draws an entity, interpolated.` |
  | `Controls:` | yes | `arrows or WASD` (or `none`) |
  | `Packages:` | yes | `@mcthaydt/automata` |
  | `Difficulty:` | yes | `★☆☆☆` to `★★★★` |
  | `Tier:` | yes | `core` or `plus` |
  | `Host:` | no | Fake-host settings: `grant=saves; saves=best:12.5; offline` |
  | `Golden:` | no | Ticks to replay for the parity test, for example `120` |
  | `Pending:` | no | A task ID whose verbs this example needs and which hasn't landed (§7) |

  `Base:` is dropped: no example builds on a game.
- **Size budget:** at most 100 lines of code, not counting the header, blank lines or comment-only lines. When an example can't fit, a core verb is missing. That becomes a DX or PRODUCT task; the budget is not raised.
- **Screenshot:** `examples/<module>/<module>-<name>.png`, committed only after the Owner approves it (the existing evidence rule).

## 3. A target example

This sketch shows the reading experience the examples hold the API to. The exact verbs are DX.2's and DX.2b's to settle; this file is their acceptance test (EX-D2).

```ts
// core-input-keys: move a square with the keyboard
//
// Shows: keys() turns keys into one sim command per tick; rect() draws an entity, interpolated.
// Controls: arrows or WASD
// Packages: @mcthaydt/automata
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 120
import { defineCommand, defineComponent, defineGame, definePlugin, defineSystem, keys, rect, u } from '@mcthaydt/automata'

const Body = defineComponent('body', { x: u.f32, y: u.f32 })
const Move = defineCommand('move', { x: u.i8, y: u.i8 })

const move = defineSystem('move', ({ commands, query }) => {
  for (const { x, y } of commands(Move)) for (const body of query(Body)) {
    body.x += x * 2
    body.y += y * 2
  }
})

const square = definePlugin({ defs: [Body, Move, move], setup: ({ spawn }) => spawn(Body, { x: 160, y: 90 }) })

export default defineGame({
  id: 'core-input-keys',
  size: { width: 320, height: 180 },
  sim: { plugins: [square], seed: 1 },
  input: keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 }, ArrowUp: { y: -1 }, ArrowDown: { y: 1 } }),
  views: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) },
})
```

**As built (2026-10-23).** The shipped [`core-input-keys`](../../../examples/core/core-input-keys.ts) is the reference, not this sketch. The sketch's verbs differ from what DX.1 to DX.2b settled: `definePlugin({ name, defs })` (the `name` is hashed, so it stays required), `defineComponent('body', { x: 'f32' })` and `defineCommand('move', zodSchema)` instead of `u` field types, `ctx.commands.of(Move)` and `body.get`/`body.set` instead of `commands(Move)` and `body.x`, and the spawn in `defineGame({ sim: { setup } })` instead of the plugin. None of them became sim API (docs/02, "DX.1 follow-up — EX example API gaps").

## 4. The sim inside one file, still deterministic

An example's sim sits in a browser file, so the per-file sim boundary (`pnpm boundaries`, which bans DOM globals and allows sim-only imports) can't apply to the whole file. Two checks keep the sim rules:

1. **`automata-check-boundaries --inline <files>`**, a new mode in `tooling/check-boundaries/src/check.ts`:
   - It checks the bodies of functions passed to `defineSystem`, and `definePlugin`'s `setup`, against the existing rules: `BANNED_GLOBALS` (including `Date`, timers, `console` and DOM globals), banned members, `Math.*` outside the allowed list, `**`, `Object.keys/values/entries` and `for…in`.
   - File-level imports are not checked in this mode; the file is a browser file.
   - A finding names the file, line and rule, as today.
   - Root `pnpm boundaries` runs it over `examples/**/*.ts`.
2. **`Golden: <ticks>`:**
   - One parametric parity test replays each such example's sim headless for that many ticks from `examples/__goldens__/<module>-<name>.replay` (the M2.3 `.replay` v1 format and `replayGolden`).
   - It expects identical hashes in Node, Chromium, WebKit and Firefox.
   - A mismatch is investigated, never re-baselined per engine (AGENTS.md).

A sim too big for this belongs in a game's `sim/` folder, where the per-file check applies. A large example sim is a sign it should be a game.

## 5. One runner instead of one app per example

- **`tooling/examples-runner`** (unpublished; owner: integration):
  - **The Vite plugin** serves and builds every `examples/**/<module>-<name>.ts` at `/<module>/<name>/` from one generated HTML template:
    - `no-eval` imported first;
    - Ruken's `compileHeaders` CSP in dev and preview, as `examples/demo-host/preview-headers.ts` does today;
    - the page calls `startGame(example)`.
  - **The index page** lists examples grouped by module with their header fields. It shows the approved screenshot, the running example in the fake host's frame, and the source beside it, as raylib's site does. It replaces `examples/gallery`.
  - **The fake host:** `examples/demo-host` moves to `tooling/examples-runner/host/`. The `Host:` header supplies its `grant`, `saves` and `offline` parameters.
- **`examples/` becomes one workspace package** (`@af-examples/examples`) with one `package.json`, one `tsconfig.json` and one `vite.config.ts` that uses the plugin. `pnpm-workspace.yaml` replaces `examples/*` and `examples/*/*` with `examples` and `games/*`.
- **Commands:**
  - `pnpm examples` serves the index;
  - `pnpm examples core-input-keys` opens one example;
  - `pnpm build:examples` builds all of them and replaces `build:demos` in `ci:local` and `ci.yml`.
- **No per-example `ship.config.ts` or `ruken.toml`.** Examples are shown under the fake host with Ruken's headers. Real Ruken publishing stays proven by the placeholder and Emberwick through `game-ci.yml`.
- **Tests,** all parametric over the files, so adding an example adds no test file:

  | Test | Layer | What it checks | Replaces |
  |---|---|---|---|
  | Catalog | Unit (Node) | Path pattern, known module, header fields, the 100-line budget, public imports only, a screenshot only where approved, `Pending:` names an open task in 02 | `examples/gallery/src/gallery.test.ts`, `demos.ts` |
  | Smoke | Playwright project `examples` (Pixel 7, plus 780×270 landscape) | Each non-pending example boots under the fake host, reaches semantic ready, and logs no console error or CSP violation | The `demos` project and the per-demo `e2e/origin.ts` wiring |
  | Parity | Vitest browser projects plus Node | Every `Golden:` example matches its replay hash in all four engines | Per-demo `golden.parity.test.ts` |
  | Inline boundaries | `pnpm boundaries` | §4 | The per-demo `sim/` entries in the root `boundaries` script |

## 6. Migration: nothing loses coverage

Each existing demo becomes one or two files. Behavior that only its `e2e/` or unit tests proved moves into the package that owns the behavior, and passes there, before the demo folder is deleted.

| Today | Becomes | Behavior tests move to |
|---|---|---|
| `runtime/boot-and-flow` | ~~`core/core-screens-and-flow.ts`~~ none (as built, 2026-10-23: [plan](../plans/2026-10-23-ex4-boot-and-flow.md)) | Boot failure modes and the veil go to `packages/runtime` tests (`run-game.test.ts`, `flow/`; the 30 s stall and the host that never says ready run on fake timers). The Effect-share budget is the placeholder's S8 `effectShareBytes`. No example: custom screens need `ScreenDef`, which the umbrella does not export, and the default flow is what every example shows. |
| `render-pixi/renderer-2d` | `render/render-interpolation.ts`, `render/render-filter.ts` | `packages/render-pixi` (its parity suite already exists) |
| `host/lifecycle-and-saves` | `core/core-host-lifecycle.ts`, `core/core-saves.ts` (`Host: grant=saves`) | `packages/host` contract tests (denied and offline saves, best-time round trip) |
| `content/hot-reload` | `content/content-hot-reload.ts` + `resources/content/hot-reload/room.toml` | `packages/content` (schema issues carry their row; the newest save wins) |
| `ui/primitives` (a fixture viewer, not an example) | `packages/ui` as its dev fixture page; examples `ui/ui-screen-frame.ts`, `ui/ui-action-bar.ts` | Stays with the `ui` layout contracts |
| `physics/bodies-2d` | `physics/physics-bodies-2d.ts` in `automata-plus` (PRODUCT.5), keeping its golden hash | `packages/physics` (room colliders, collision events) |
| `base-2d` (Emberwick) | `games/emberwick` (EX-D1). Package name `@af-examples/base-2d` is kept; paths are updated where they appear (appendix B). | Unchanged; its journeys and golden must stay green |
| `placeholder` | `games/placeholder` (the ship lane's page, not an example) | Unchanged |
| New, written first (EX-D2) | `core/core-basic-window.ts` (DX.2's hello; replaces `examples/game/hello`), `core/core-input-keys.ts`, `shapes/shapes-rects.ts`, `textures/textures-sprite.ts` | — |
| Waiting demos | `sim/sim-record-replay.ts` (M2.3), `sim/sim-content-restore.ts` (M2.2) | — |

The rule stays: a feature without an example is not done. Later lanes add theirs as one file each, for example `core-input-gamepad` and `core-camera-2d` (M4), `text-localized` (PRODUCT.L) and `audio-*` (M5).

## 7. Failure policy

| Case | Result |
|---|---|
| Missing or malformed header field | Catalog fails, naming the file and field |
| Over 100 code lines | Catalog fails with the count; the fix is a core verb, not a bigger budget |
| A relative, cross-example, game or deep package import | Catalog fails, naming the import |
| A banned global or operator inside a `defineSystem` body | `pnpm boundaries` fails with file, line and rule |
| A `Golden:` hash differs in any engine | Parity fails; investigate, never re-record per engine |
| An example needs verbs that haven't landed (EX-D2) | Its `Pending: DX.2` header excludes it from typecheck, smoke and parity. The runner and the test report list it as **pending**, never as passed. When `DX.2` is ticked in 02 the catalog fails until the `Pending:` line is removed. |
| A console error or CSP violation at boot | Smoke fails and keeps the first-attempt trace |

## 8. Ownership and acceptance

| Artifact | Owner | Consumers |
|---|---|---|
| `tooling/examples-runner` (plugin, index, fake host, catalog) | integration | every lane, the website |
| `--inline` mode | `tooling/check-boundaries` (sim lane) | `pnpm boundaries`, `automata check` (DX.6) |
| Each example | the lane that owns its feature | readers, agents, the website |
| `games/emberwick`, `games/placeholder` | integration, ship lane | CI |

**Acceptance:**
- **E-a.** Every file under `examples/<module>/` is one `.ts` file of 100 code lines or fewer, with a valid header.
- **E-b.** Adding an example means adding one file, plus one `.replay` when it declares `Golden:`. No config or test file changes.
- **E-c.** Smoke is green for every non-pending example at Pixel 7 and 780×270.
- **E-d.** Golden parity holds in Node, Chromium, WebKit and Firefox.
- **E-e.** Every behavior test listed in §6 passes in its package before its demo folder is deleted.
- **E-f.** Emberwick's journeys and golden are unchanged at `games/emberwick`.
- **E-g.** Failure case: a fixture example with `Date.now()` in a system fails `pnpm boundaries`.
- **E-h.** Failure case: a fixture example of 101 lines fails the catalog.

## 9. Owner decisions (2026-10-16)

| ID | Decision |
|---|---|
| EX-D1 | Emberwick moves to `games/emberwick` (raylib keeps games apart from examples). `examples/` holds only one-file examples. |
| EX-D2 | The examples are written first, as the target API. They are the failing acceptance tests that DX.2 (`startGame`/`defineGame`) and DX.2b (`rect`/`sprite`) must satisfy. |

## 10. Tasks

| ID | Task | Lane | Depends on |
|---|---|---|---|
| EX.0 | This spec, reviewed | integration | — |
| EX.1 | Runner, the single `examples` package, catalog, smoke and parity tests, `--inline` boundaries | integration, sim (for `--inline`) | EX.0 |
| EX.2 | Move Emberwick to `games/emberwick` and the placeholder to `games/placeholder` | integration, ship | EX.0 |
| EX.3 | Target examples (`core-basic-window`, `core-input-keys`, `shapes-rects`, `textures-sprite`) as DX.2/DX.2b acceptance, `Pending:` until those land | integration | EX.1 |
| EX.4 | Port the existing demos per §6: behavior tests first, then the one-file example, then delete the folder | each owning lane | EX.1, DX.2, DX.2b |
| EX.5 | Index page with source beside the frame | integration | EX.1 |

## Appendix A. How the counts were produced

At `5d54594`:

```sh
for d in examples/*/ examples/*/*/; do
  n=$(find "$d" -type f -not -path '*/node_modules/*' -not -path '*/dist/*' | wc -l)
  l=$(find "$d" -type f \( -name '*.ts' -o -name '*.svelte' \) -not -name '*.test.ts' -not -name '*.spec.ts' \
      -not -path '*/node_modules/*' -not -path '*/dist/*' | xargs cat 2>/dev/null | wc -l)
  echo "$n files, $l src lines  $d"
done
```

## Appendix B. Paths that name `examples/base-2d` or `examples/placeholder` (for EX.2)

Outside the two folders and `docs/`, at `5d54594`:
- root `package.json`, `playwright.config.ts`, `.github/workflows/ci.yml`, `examples/README.md`;
- `examples/demo-host/{ports,preview-headers}.ts`;
- the demos that import Emberwick (deleted by EX.4);
- `packages/ship/src/{cli-args.test,ports/ports-for,remote/test-remote,turbo-inputs.test,workflows.test}.ts`, `packages/ship/turbo.json`;
- `tooling/check-boundaries/src/{check,check.test}.ts`;
- `tooling/release/src/check-changesets.test.ts`.
