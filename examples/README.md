# Examples

Owner direction (2026-10-11): every dimension has a teeny tiny **base project** (a character in a room), and every modular feature is shown by a small standalone **demo** built on the matching base, in the style of [raylib's examples](https://www.raylib.com/examples.html). Each demo shows one thing.

## Bases

| Base | What it is | Built on | Lands in |
|---|---|---|---|
| `base-2d` | Emberwick: Wick, a hooded lantern-bearer, walks and jumps through one single-screen room of mossy night ruins to an ember (Endesga 64, pixel lighting). Splash → menu → room → pause → end. | Core only: `sim`, `content`, `host`, `runtime`, `render-pixi`, `ui` | M1.8 (replaces the old `blank-game`). First version built: [`examples/base-2d`](base-2d/), on `sim` with stand-ins for the core pieces not yet on `main` (content module, direct `Ruken.init`, its own loop and Pixi renderer, DOM screens); each stand-in is swapped for the core package when its lane merges ([task spec](../docs/superpowers/specs/2026-10-11-m1-base-2d-design.md)) |
| `base-25d` | The same character as a billboard sprite in a fixed-camera 3D room with GLB props | Core + `render-pixi3d` (private builds, D-1) | M3 |
| `base-3d` | The same character as a mesh in a 3D room with a follow camera | Core + `render-pixi3d` (private builds, D-1) | M3; the starting point for GAME-3D |

A base is the smallest complete game on AF: it boots under the fake Ruken host and in a real Ruken frame, publishes through `ship`, and plays on a phone. Each base exports its room, character and content as a workspace package (`@af-examples/base-2d`, …) so demos reuse them instead of copying them.

## Demos

- **Location:** `examples/<package>/<demo>/`, where `<package>` is the core package or extension shown (`examples/physics/bodies-2d/`, `examples/feel/hit-stop/`, `examples/ui/action-bar/`). The folder name says what it shows.
- **Shape:** one entry file (`main.ts`) plus the demo's own content, on top of a base. A reader learns the feature from that one file. No demo depends on another demo.
- **Header:** `main.ts` starts with a comment block: what it shows, the controls, the base it uses and the packages it needs.
- **Runs:** `pnpm --filter <demo> dev` serves it under the fake Ruken host (`cli dev`); the gallery (`examples/gallery`, M1.8) lists every demo with a screenshot and a link to its source. Today the gallery is its list (`examples/gallery/src/demos.ts`, checked against the demo folders); its page and screenshots come with Owner-approved shots. Until `cli dev` exists, `pnpm --filter <demo> dev` serves the demo standalone.
- **Built on the base:** a 2D demo plays the room through `playRoom` from `@af-examples/base-2d/play` (the room, Wick, input and the loop, without the base's screens), passing its own room, sim (with its plugins), commands and drawing layers (`RendererLayer`, `@af-examples/base-2d/render`).
- **Smoke tests:** `examples/demo-host` is Ruken's fake host around any demo (`?game=<url>&id=<game id>`, plus seeded `saves`, a `grant` list and `offline`; `hostedUrl` builds it). `@af-examples/demo-host/testing` has `openHosted`, which waits for the demo's frame and its ready, and `collectErrors`, which also turns CSP violations into errors. Each demo's `e2e/*.e2e.ts` runs in the `demos` project of `pnpm test:e2e`, against its build served with Ruken's headers.
- **A demo's sim:** sim code the demo adds lives in its `sim/` folder, imports only the sim, extension sim entry points and the base's sim (`@af-examples/base-2d/sim`, never the base's package root), and is listed in the root `pnpm boundaries`. A demo whose sim claims the same result on every engine has a golden run and a `*.parity.test.ts` (as `physics/bodies-2d` does).
- **Checked:** each demo has a smoke test that boots it under the fake host, waits for ready and asserts no console errors; CI builds every demo. Screenshots for the gallery are evidence, promoted only after Owner approval.
- **Art:** Endesga 64 and the look in the [art direction](../docs/art/README.md): Bubble Bobble and Celeste as influences, with a modern, original treatment like `base-2d`'s. Art may come from any generation API the project has access to (Owner, 2026-10-11), through the `pipelines` gates once they exist (M3), with provenance recorded.

## Who builds what

Each lane's PR ships the demos for the feature it builds, on the base that feature needs. A demo whose base does not exist yet is listed below as waiting and is finished by the integration owner in M1.8 (2D) or M3 (2.5D and 3D).

| Demo | Owner | Base | Status |
|---|---|---|---|
| `host/lifecycle-and-saves` | host lane | `base-2d` | Built (feature-demos PR, #14) |
| `content/hot-reload` | content lane | `base-2d` | Built (feature-demos PR, #14) |
| `ui/primitives` (every primitive at every reference size; no renderer needed) | ui lane | none | With the ui PR (#7); needs no base |
| `runtime/boot-and-flow` (boot program, veil overlay, error panels, Flow transitions) | runtime lane | none | Built (M1.5 runtime) |
| `render-pixi/renderer-2d` (2D Pixi renderer, sub-tick interpolation, screen-space filter shader) | runtime lane | none | Built (M1.7 render-pixi) |
| `physics/bodies-2d` (Rapier crates and balls in the room, pushed by the character; [spec](../docs/superpowers/specs/2026-10-11-m2-physics-demo-design.md)) | sim lane, M2.1b | `base-2d` | Built on `playRoom` (#14, finished in #17; spec §11 lists the deviations); waits on the Owner's look at the screenshots |
| `physics/bodies-3d` | sim lane | `base-3d` | Waits on `base-3d` (M3) |
| `sim/content-restore` (a snapshot is gated by gameplay content, not by store metadata; [spec](../docs/superpowers/specs/2026-10-11-m2-content-in-sim-design.md#8-demo-examplessimcontent-restore)) | content lane, M2.2 | `base-2d` | Package work in the M2.2 PR; the demo waits on base-2d content swap (room in `content/rooms/*.toml`, `createBaseSim({ content })`) |
| `testing/record-replay` (play, then watch the run re-simulated from its `.replay` with every check passing; [spec](../docs/superpowers/specs/2026-10-11-m2-goldens-and-replays-design.md#8-demo-examplestestingrecord-replay)) | testing lane, M2.3 | `base-2d` | Format, harness and goldens done in the M2.3 PR; the demo waits on base-2d's `startGame` options and `./sim` export, then lands as its own PR |
| `placeholder` (the ship lane's page: boots under the fake host and publishes through `ship`; not a feature demo) | ship lane | none | With the ship PR |
