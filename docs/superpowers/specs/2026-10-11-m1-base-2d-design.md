# M1.8 part 1: `examples/base-2d`, the 2D base project

- **Status:** Drafted 2026-10-11 by the integration owner, for Owner review in this task's PR. Built on `main` at `dd1386f` (PRs #4 and #6 merged).
- **Task:** M1.8, first slice: the base project only. The demo gallery, `create-game` and the M1 exit evidence stay open under M1.8 ([02 Master delivery plan](../../02-master-delivery-plan.md)).
- **Parents:** [Ruken-first master spec](./2026-10-11-automata-framework-ruken-first-design.md) §9.1; [`examples/README.md`](../../../examples/README.md); [art direction](../../art/README.md); [M1 shared contracts](./2026-10-11-m1-shared-contracts-design.md) §2 (determinism check).
- **Consumes (all on `main`):** `@mcthaydt/automata-sim` (sim core and its `./math` export), `@mcthaydt/automata-ship` (`defineShipConfig`, `rukenToml`, `checkManifest`, `automata-ship prepare`), the vendored `@ruken/sdk`, `@ruken/sdk-host` and `@ruken/manifest` (D-6), `effect` 3.22.2.

## 1. Goal and boundaries

**Observable result.** `pnpm --filter @af-examples/base-2d dev` serves a pixel-art character in one single-screen room. The player goes splash → menu → room → pause → end: they walk, jump and reach the ember at the top of the room, which ends the round. It boots standalone and inside a Ruken frame (the real SDK handshake), renders nothing before the host says ready, plays with keyboard or touch on a phone in either orientation, and builds through the M1.2 pipeline (`vite build`, `automata-ship prepare`, `game-ci.yml` with the determinism check on its sim sources).

**What `main` lacks, and what the base does meanwhile.** The master spec builds `base-2d` on `sim`, `content`, `host`, `runtime`, `render-pixi` and `ui`. On 2026-10-11 only `sim`, `node` and `ship` are on `main`; content (#8), host (#5) and ui (#7) are open PRs, and runtime and `render-pixi` (M1.5, M1.7) are not started. The coordinator's instruction is to use only what is on `main`. So each missing piece is a small, clearly marked stand-in inside the example, never a copy of another lane's API:

| Missing core piece | Stand-in in `base-2d` (file) | Replaced by |
|---|---|---|
| `content` (M1.3, #8) | The room is a typed TypeScript module (`src/content/room.ts`), passed to the sim as `content` so it is hashed with the snapshot | A `content/rooms/*.toml` file compiled by `automata-content` |
| `host` (M1.4, #5) | `src/boot.ts` calls `Ruken.init` directly, as `examples/placeholder` does; no bridge code of its own | The `Hosting` service |
| `runtime` (M1.5) | `src/loop.ts`: a fixed-step loop with an injected clock and frame scheduler | The runtime app loop, Time and Flow managers |
| `render-pixi` (M1.7) | `src/render/`: Pixi 8 initialised the way FloorFifty does (no-eval entry, WebGL preference, nearest scaling, integer letterbox) | `render-pixi` with its `RenderDelta` consumer |
| `ui` (M1.6, #7) | `src/screens/`: plain DOM screens with 44 px controls and 48 px primary actions, colors from Endesga 64 | `ui` primitives and theme tokens |

The sim half is the real thing: a sim plugin on `automata-sim`, checked by `check-boundaries`, with a golden hash identical in Node, Chromium, WebKit and Firefox. Demos and games reuse it through the package exports.

**Deliverables.** `examples/base-2d/` (package `@af-examples/base-2d`): sim plugin, room content, art as palette-indexed pixel maps, renderer, screens, input, loop, boot, ship config, unit and parity tests, browser journeys; a `base-2d` project in the root `playwright.config.ts`; a `base-2d` job in `ci.yml` through `game-ci.yml`; the three `@mcthaydt/automata-sim` entry points added to the `check-boundaries` import allowlist (identical to the change in PR #9, so the two merge cleanly); `pixi.js` pinned in `docs/versions.md`.

**Exclusions.** No demos (listed as waiting in [`examples/README.md`](../../../examples/README.md)), no gallery, no `create-game`, no saves, audio, gamepad or localisation (M4, M5), no Rapier physics (the room needs only tile collision; `physics` is an extension, PR #9). `examples/placeholder` stays: it carries the S8 budgets and is retired when the runtime lands.

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| Character position, velocity, grounded, jump timers; whether the goal is reached | The sim (`src/sim/`) | Only sim systems, from `move` commands |
| The room (tiles, start, goal) | Content (`src/content/room.ts`) | Authors; frozen inside the sim |
| Which screen shows (splash, menu, room, paused, end) | `src/flow.ts`, a pure state machine | The page's event handlers and the host's lifecycle and menu events |
| Held keys and touch buttons | `src/input/` | DOM events |
| Pixels, squash and stretch, dust | `src/render/` | Reads `RenderDelta` and sim events; never writes the sim |
| The session (handshake, player, lifecycle, rounds) | `@ruken/sdk` through `src/boot.ts` | The SDK |

## 3. Contracts

**Sim plugin (`src/sim/`, exported as `base2dPlugin`).** Units are subpixels: 256 per pixel, integers (`i32`), so collision is exact and needs no float rounding. The tick rate is 60 Hz.

- Component `player` (rendered): `x`, `y` (hitbox top-left, subpixels), `vx`, `vy` (subpixels per tick), `facing` (`1` or `-1`), `grounded`.
- Component `player-control` (not rendered): `coyote`, `buffer`, `varJump` (ticks left), `jumpHeld`.
- Command `move`: `{ x: -1 | 0 | 1, jump: boolean }`, the held state, sent every tick in the room.
- Events: `player.jumped`, `player.landed`, `goal.reached`, each `{ x, y }` in pixels.
- Resource `progress`: `{ reached: boolean, tick: number }`.
- Movement follows Celeste's published constants at 60 Hz (max run 90 px/s, gravity 900 px/s², half gravity near the apex while jump is held, max fall 160 px/s, jump −105 px/s held for up to 0.2 s, coyote time 0.1 s, jump buffer 0.08 s), converted to subpixels per tick in `src/sim/tuning.ts`.
- Movement is resolved one pixel at a time on each axis against solid tiles, so the character never tunnels or overlaps a wall.
- `createBaseSim({ seed, room? })` creates the sim with the room as content and spawns the player at the room's `P`.

**Room (`src/content/room.ts`).** `{ id, tileSize: 8, rows: string[] }`, 40 × 24 tiles (320 × 192 pixels). `#` is solid, `.` empty, `P` the start, `G` the goal. `parseRoom` rejects ragged rows, unknown characters, or anything but one `P` and one `G`.

**Flow (`src/flow.ts`).** `type Screen = 'splash' | 'menu' | 'room' | 'paused' | 'end'`; `next(screen, event)` with events `continue`, `play`, `pause`, `resume`, `quit`, `goal`, `background`, `menu-request`. Invalid pairs return the same screen.

**Input (`src/input/`).** Keyboard: arrows or A/D move, Space, Z, W or Up jump, Escape or P pause. Touch: on-screen left, right and jump buttons, shown on coarse pointers. `toMove(held)` gives the `move` payload; left and right together cancel.

**Art (`src/art/`).** Sprites as palette-indexed pixel maps: each character of a row names an Endesga 64 color, `.` is transparent. Provenance in `src/art/PROVENANCE.md`.

## 4. Data and lifecycle flow

1. The page loads with an empty `#game` (nothing renders before ready, Ruken R-04). `main.ts` imports `src/no-eval.ts` first (`pixi.js/unsafe-eval`, Zod jitless).
2. `boot` runs `Ruken.init({ gameId: 'base-2d', wants: [], pauseBehavior: 'pause', onMenuRequest })` and waits for `session.ready`. Before ready, `onMenuRequest` returns `false`.
3. After ready: create the sim, initialise Pixi into `#game`, build the screens, show `splash`. `data-state="ready"` is set on `<html>`.
4. Splash continues on any key or tap (or after 1.5 s) to the menu; Play enters the room and calls `session.round.start()`.
5. In the room, the loop steps the sim at 60 Hz from the accumulated real time (at most 5 steps per frame, so a long stall does not spiral) and sends one `move` command per step. The renderer draws after each frame.
6. Pause (button, Escape/P, the host's menu, or the lifecycle going to `background`) stops stepping. Resume continues; Quit ends the round (`quit`) and returns to the menu with a fresh sim.
7. `goal.reached` ends the round (`complete`) and shows the end screen with the time; Play again restarts with a fresh sim.

## 5. Failure policy

- `Ruken.init` or `ready` rejects: show "Couldn't connect to Ruken." and set `data-state="failed"` (as the placeholder does). No retry loop; the host owns reloads.
- Pixi `init` throws (no WebGL): the same failure path with "This device can't run the game." Never a blank canvas.
- A rejected sim command is a bug in the input layer: it is logged once with `console.error`, and the browser journeys fail on any console error.
- `parseRoom` throws at startup on a malformed room; the room is source code, so this fails the unit tests first.

## 6. UI inventory and responsive behavior

| Screen | Contents | Focus and input |
|---|---|---|
| Splash | "AutomataFramework" mark over the room's backdrop | Any key, click or tap continues |
| Menu | Title, Play (primary, 48 px) | Play focused; Enter or tap |
| Room | Canvas; Pause button (44 px, top right, inside safe areas); touch left, right, jump (56 px) on coarse pointers | Keyboard and touch as §3 |
| Paused | Resume (primary), Quit | Resume focused; Escape resumes |
| End | "The ember is yours", time, Play again (primary), Menu | Play again focused |

The canvas is the room at 320 × 192 scaled by the largest integer that fits the usable area (inside safe-area insets), letterboxed on Endesga's darkest navy. Below 1× the canvas scales down smoothly rather than cropping. Overlays use the container's size, not the viewport's, and keep their buttons on screen at 780 × 270 (compact height) by stacking actions in a row.

## 7. Test allocation

| Layer | What | Where |
|---|---|---|
| Unit (Node) | Room parsing; movement (run, walls, gravity, landing, jump, coyote, buffer, variable height, ceiling); goal; golden hash of a scripted run; flow transitions; input mapping; loop stepping with a fake clock; palette check of every art color against `docs/art/palettes/endesga-64.txt`; ship config; boot under Ruken's fake host | `src/**/*.test.ts` |
| Parity | The scripted run's golden hash in Chromium, WebKit and Firefox equals Node's | `src/sim/golden.parity.test.ts` |
| Determinism check | `check-boundaries` on `src/sim` | `game-ci.yml` with `sim-roots: src/sim`, and locally |
| Browser journeys (Pixel 7 and a 780 × 270 landscape phone) | Boots standalone under Ruken's headers with no console errors; splash → menu → room → pause → resume; walks and jumps to the goal with the keyboard and reaches the end screen; touch controls; completes the handshake inside a fake host frame on another origin | `e2e/*.e2e.ts`, project `base-2d` |
| Owner gates | The look (screenshots under `evidence/`), playing on a real phone | PR review |

## 8. Ruken alignment

- Handshake, ready gate, lifecycle, menu request, rounds: `@ruken/sdk` `InitOptions`, `RukenSession` (vendored at RukenApp `b30d31b`).
- Headers: `vite preview` serves with `@ruken/manifest`'s `compileHeaders` (Ruken's CSP, no eval), as the placeholder does.
- Manifest: generated by `automata-ship prepare` from `ship.config.ts`; `[runtime] renderer = "webgl2"` (Pixi's `webgl` preference creates a WebGL2 context, the AF default).

## 9. Sources

- FloorFifty `45482fb`: `apps/client/src/no-eval.ts` (no-eval entry, Zod jitless) and `managers/app.ts` (WebGL preference, `antialias: false`, nearest scaling).
- `examples/placeholder` (`main`): boot shape, fake-host tests, e2e host page.
- Celeste's movement constants (Maddy Thorson's published `Player.cs`, 2018) for the feel; the code here is new.

## 10. Exit criteria

- **Success:** `pnpm check` and `pnpm test:parity` pass; `pnpm --filter @af-examples/base-2d check`, `build` and `prepare-ruken` pass; the `base-2d` browser journeys pass locally; `game-ci` on `af-linux` is green for the PR.
- **Failure cases covered:** a host that never says ready shows nothing; a failing handshake shows the error text; walking into a wall stops at it; the goal fires once.
- **Open after this slice (M1.8):** demos waiting on #5, #7, #8, #9; the gallery; `create-game`; S8 re-measured on `base-2d`; published to Ruken's local stack and the dev host; phone play and the Owner's look review.
