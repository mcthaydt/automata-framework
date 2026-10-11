# Examples

Owner direction (2026-10-11): every dimension has a teeny tiny **base project** (a character in a room), and every modular feature is shown by a small standalone **demo** built on the matching base, in the style of [raylib's examples](https://www.raylib.com/examples.html). Each demo shows one thing.

## Bases

| Base | What it is | Built on | Lands in |
|---|---|---|---|
| `base-2d` | Emberwick: Wick, a hooded lantern-bearer, walks and jumps through one single-screen room of mossy night ruins to an ember (Endesga 64, pixel lighting). Splash → menu → room → pause → end. | Core only: `sim`, `content`, `host`, `runtime`, `render-pixi`, `ui` | M1.8 (replaces the old `blank-game`). First version built: [`examples/base-2d`](base-2d/), on `sim` and `content` (its room is `content/rooms/room-1.toml`), with stand-ins for the core pieces not yet on `main` (direct `Ruken.init`, its own loop and Pixi renderer, DOM screens); each stand-in is swapped for the core package when its lane merges ([task spec](../docs/superpowers/specs/2026-10-11-m1-base-2d-design.md)) |
| `base-25d` | The same character as a billboard sprite in a fixed-camera 3D room with GLB props | Core + `render-pixi3d` (private builds, D-1) | M3 |
| `base-3d` | The same character as a mesh in a 3D room with a follow camera | Core + `render-pixi3d` (private builds, D-1) | M3; the starting point for GAME-3D |

A base is the smallest complete game on AF: it boots under the fake Ruken host and in a real Ruken frame, publishes through `ship`, and plays on a phone. Each base exports its room, character and content as a workspace package (`@af-examples/base-2d`, …) so demos reuse them instead of copying them.

## Demos

- **Location:** `examples/<package>/<demo>/`, where `<package>` is the core package or extension shown (`examples/physics/bodies-2d/`, `examples/feel/hit-stop/`, `examples/ui/action-bar/`). The folder name says what it shows.
- **Shape:** one entry file (`main.ts`) plus the demo's own content, on top of a base. A reader learns the feature from that one file. No demo depends on another demo.
- **Header:** `main.ts` starts with a comment block: what it shows, the controls, the base it uses and the packages it needs.
- **Runs:** `pnpm --filter <demo> dev` serves it under the fake Ruken host (`cli dev`); the gallery (`examples/gallery`, M1.8) lists every demo with a screenshot and a link to its source.
- **Checked:** each demo has a smoke test that boots it under the fake host, waits for ready and asserts no console errors; CI builds every demo. Screenshots for the gallery are evidence, promoted only after Owner approval.
- **Art:** Endesga 64 and the look in the [art direction](../docs/art/README.md): Bubble Bobble and Celeste as influences, with a modern, original treatment like `base-2d`'s. Art may come from any generation API the project has access to (Owner, 2026-10-11), through the `pipelines` gates once they exist (M3), with provenance recorded.

## Who builds what

Each lane's PR ships the demos for the feature it builds, on the base that feature needs. A demo whose base does not exist yet is listed below as waiting and is finished by the integration owner in M1.8 (2D) or M3 (2.5D and 3D).

| Demo | Owner | Base | Status |
|---|---|---|---|
| `host/lifecycle-and-saves` | host lane | `base-2d` | Base built and host merged; to do |
| `content/hot-reload` | content lane | `base-2d` | Base built and content merged; to do |
| `ui/primitives` (every primitive at every reference size; no renderer needed) | ui lane | none | With the ui PR (#7); needs no base |
| `physics/bodies-2d` (Rapier crates and balls in the room, pushed by the character; [spec](../docs/superpowers/specs/2026-10-11-m2-physics-demo-design.md)) | sim lane, M2.1b | `base-2d` | Base built and physics merged; to do (needs base-2d's `startGame` options, `./sim` export and typed failure) |
| `physics/bodies-3d` | sim lane | `base-3d` | Waits on `base-3d` (M3) |
| `sim/content-restore` (a snapshot is gated by gameplay content, not by store metadata; [spec](../docs/superpowers/specs/2026-10-11-m2-content-in-sim-design.md#8-demo-examplessimcontent-restore)) | content lane, M2.2 | `base-2d` | Base built; to do with M2.2 (needs base-2d's content swap) |
| `testing/record-replay` (play, then watch the run re-simulated from its `.replay` with every check passing; [spec](../docs/superpowers/specs/2026-10-11-m2-goldens-and-replays-design.md#8-demo-examplestestingrecord-replay)) | testing lane, M2.3 | `base-2d` | Base built; to do with M2.3 (needs base-2d's `startGame` options) |
| `placeholder` (the ship lane's page: boots under the fake host and publishes through `ship`; not a feature demo) | ship lane | none | With the ship PR |
