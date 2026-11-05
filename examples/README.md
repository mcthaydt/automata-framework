# Examples

Owner direction (2026-10-11): every dimension has a teeny tiny **base project** (a character in a room), and every modular feature is shown by a small standalone **demo** built on the matching base, in the style of [raylib's examples](https://www.raylib.com/examples.html). Each demo shows one thing.

## One-file examples (EX spec, replacing the demos below)

The [EX spec](../docs/superpowers/specs/2026-10-16-examples-one-file-design.md) turns each demo into one file, like raylib's: `examples/<module>/<module>-<name>.ts`, a header (`Shows:`, `Controls:`, `Packages:`, `Difficulty:`, `Tier:`, and optionally `Host:`, `Golden:`, `Pending:`), 100 code lines or fewer, public imports only (`@mcthaydt/automata`, `zod`, an extension's entry; core packages are reached through the umbrella). This folder is one package (`@af-examples/examples`) on the runner in [`tooling/examples-runner`](../tooling/examples-runner/):

- `pnpm examples` serves the index (every example under its module with its header fields and approved screenshot; **View** opens it under the fake host with its source beside it, **Source** shows the file) and the fake host; `pnpm examples <module>-<name>` opens one example; `pnpm build:examples` builds them all.
- The catalog test checks every file's path, module, header, budget, imports, screenshot approval (`screenshots-approved.json`) and `Pending:` task; the `examples` and `examples-compact` Playwright projects boot each one under the fake host at Pixel 7 and 780 × 270; the parity test replays each `Golden:` example from `__goldens__/<module>-<name>.replay` in Node, Chromium, WebKit and Firefox; `pnpm boundaries` runs `--inline` over this folder. Adding an example adds one file (and its `.replay` when it declares `Golden:`).
- The first examples arrive with EX.3; the demos below keep running until EX.4 ports and deletes them.

## Bases

| Base | What it is | Built on | Lands in |
|---|---|---|---|
| `emberwick` | Emberwick: Wick, a hooded lantern-bearer, walks and jumps through one single-screen room of mossy night ruins to an ember (Endesga 64, pixel lighting). Splash → menu → room → pause → end. | Core only: `sim`, `content`, `host`, `runtime`, `render-pixi`, `ui` | M1.8 (replaces the old `blank-game`). First version built: [`games/emberwick`](../games/emberwick/) (moved from `examples/emberwick` by EX.2, EX-D1; package name `@af-games/emberwick` kept), on `sim` with stand-ins for the core pieces not yet on `main` (content module, direct `Ruken.init`, its own loop and Pixi renderer, DOM screens); each stand-in is swapped for the core package when its lane merges ([task spec](../docs/superpowers/specs/2026-10-11-m1-emberwick-design.md)) |
| `base-3d` | Two 3D rooms with the player and a target as procedural characters (Wick as `figures` data), IK-posed clips and a lock-on aim demo, under authored angled camera views on a 24 mm lens (25° down, 5 m back, turned freely; [revised M3 spec](../docs/superpowers/specs/2026-10-18-m3-3d-characters-design.md) §4.7) | Core + `render-pixi3d` and `figures` (free, in this repo; unpublished and private builds while D-1 stands) | M3.7, the first slice of the base 3D game (Emberwick's 3D counterpart); GAME-3D grows it |

A base is the smallest complete game on AF: it boots under the fake Ruken host and in a real Ruken frame, publishes through `ship`, and plays on a phone. Each base exports its room, character and content as a workspace package (`@af-games/emberwick`, …) so demos reuse them instead of copying them.

## Demos

- **Location:** `examples/<package>/<demo>/`, where `<package>` is the core package or extension shown (`examples/content/hot-reload/`, `examples/feel/hit-stop/`, `examples/ui/action-bar/`). The folder name says what it shows.
- **Shape:** one entry file (`main.ts`) plus the demo's own content, on top of a base. A reader learns the feature from that one file. No demo depends on another demo.
- **Header:** `main.ts` starts with a comment block: what it shows, the controls, the base it uses and the packages it needs.
- **Runs:** `pnpm --filter <demo> dev` serves the demo standalone. The examples index above replaced the gallery (EX.5); the demos get there as one-file examples in EX.4.
- **Built on the base:** a 2D demo plays the room through `playRoom` from `@af-games/emberwick/play` (the room, Wick, input and the loop, without the base's screens), passing its own room, sim (with its plugins), commands and drawing layers (`RendererLayer`, `@af-games/emberwick/render`).
- **Smoke tests:** `tooling/examples-runner/host` is Ruken's fake host around any demo (`?game=<url>&id=<game id>`, plus seeded `saves`, a `grant` list and `offline`; `hostedUrl` builds it). `@mcthaydt/examples-runner/host/testing` has `openHosted`, which waits for the demo's frame and its ready, and `collectErrors`, which also turns CSP violations into errors. Each demo's `e2e/*.e2e.ts` runs in the `demos` project of `pnpm test:e2e`, against its build served with Ruken's headers.
- **A demo's sim:** sim code the demo adds lives in its `sim/` folder, imports only the sim, extension sim entry points and the base's sim (`@af-games/emberwick/sim`, never the base's package root), and is listed in the root `pnpm boundaries`. A demo whose sim claims the same result on every engine has a golden run and a `*.parity.test.ts` (as `physics/bodies-2d` did before it moved to Automata Plus).
- **Checked:** each demo has a smoke test that boots it under the fake host, waits for ready and asserts no console errors; CI builds every demo. Screenshots for the examples index are evidence, shown only once the Owner approves them (`examples/screenshots-approved.json`).
- **Art:** Endesga 64 and the look in the [art direction](../docs/art/README.md): Bubble Bobble and Celeste as influences, with a modern, original treatment like `emberwick`'s. Art may come from any generation API the project has access to (Owner, 2026-10-11), through the `pipelines` gates once they exist (M3), with provenance recorded.

## Who builds what

Each lane's PR ships the demos for the feature it builds, on the base that feature needs. A demo whose base does not exist yet is listed below as waiting and is finished by the integration owner in M1.8 (2D) or M3 (3D; 2.5D was dropped 2026-10-18).

| Demo | Owner | Base | Status |
|---|---|---|---|
| `content/hot-reload` | content lane | `emberwick` | Built (feature-demos PR, #14) |
| `ui/primitives` (every primitive at every reference size; no renderer needed) | ui lane | none | With the ui PR (#7); needs no base |
| `physics/bodies-2d` (Rapier crates and balls in the room, pushed by the character; [spec](../docs/superpowers/specs/2026-10-11-m2-physics-demo-design.md)) | sim lane, M2.1b | `emberwick` | Retired in PRODUCT.5g (plan P5-D3): physics is Automata Plus, and the demo returns there as the one-file example `physics/physics-bodies-2d.ts` (EX.4p); its golden `ad621eea6325a8db` is retired |
| `sim/content-restore` (a snapshot is gated by gameplay content, not by store metadata; [spec](../docs/superpowers/specs/2026-10-11-m2-content-in-sim-design.md#8-demo-examplessimcontent-restore)) | content lane, M2.2 | `emberwick` | Package work in the M2.2 PR; the demo waits on emberwick content swap (room in `content/rooms/*.toml`, `createBaseSim({ content })`) |
| `testing/record-replay` (play, then watch the run re-simulated from its `.replay` with every check passing; [spec](../docs/superpowers/specs/2026-10-11-m2-goldens-and-replays-design.md#8-demo-examplestestingrecord-replay)) | testing lane, M2.3 | `emberwick` | Format, harness and goldens done in the M2.3 PR; the demo waits on emberwick's `startGame` options and `./sim` export, then lands as its own PR |
