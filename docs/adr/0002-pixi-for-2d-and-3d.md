# ADR 0002: PixiJS for 2D and 3D

- Status: Accepted by Owner direction (2026-10-11); written-spec review pending
- Date: 2026-10-11
- Supersedes: the `render-three` package in the [2026-10-01 master spec](../superpowers/specs/2026-10-01-automata-framework-overview-design.md) §4 and §8, and the S3 consequences for A2/A4

## Context
The 2026-10-01 design had two render adapters: Three.js (WebGPURenderer with a TSL post stack) for 3D and PixiJS 8 for 2D. Spikes S3 and S4 both passed. Since then, the two reference games have settled on Pixi: FloorFifty (2D) ships on Pixi 8, and The Last Light renders a real 3D clinic with Pixi 8.22 and the `@pixi/3d` 0.1.0-beta.2 closed beta (View3D, perspective camera, fog, Sprite3D billboards, GLB props, a GLSL + WGSL post chain), falling back from WebGPU to WebGL. The Owner directed on 2026-10-11: "we'll use PixiJS for 2D and 3D".

## Decision
- One renderer family. Core `render-pixi` covers 2D and the shared pieces (renderer init on WebGL2 by default with WebGPU opt-in and one WebGL2 retry, the no-eval entry for Ruken's CSP, pixel framebuffer, `RenderDelta` consumption and interpolation, GLSL + WGSL filter helpers).
- 3D is the `render-pixi3d` extension on `@pixi/3d`, pinned to a vendored tarball. Core never imports it. Until AF 1.0 it covers the 2.5D scope The Last Light proves (fixed-zone cameras, billboards, GLB props); full 3D is added in M9 from a 3D game built on AF (Owner roadmap, 2026-10-11).
- Post effects are written once as GLSL + WGSL pairs that work in 2D and 3D, taking pixel position from the vertex stage (S4).
- The `RenderDelta` contract from the sim stays renderer-agnostic, so a different 3D backend could be added later without touching the sim.

## Consequences
- `render-three`, the TSL post stack and the S3 verdict's consequences are retired. S3 stays as a historical record.
- New spike **S7** before the M3 plan: `@pixi/3d` under Ruken's CSP (`script-src 'self' 'wasm-unsafe-eval'`, no `eval`), WebGL2 parity with WebGPU for the post chain, FPS on the S20 and iPhone 13 profiles, a non-black capture path on the CI GPU runner, and the beta API surface AF depends on.
- Ruken's manifest renderer values are `webgl2`, `webgl`, `canvas2d` and `wasm-webgl2`, so the WebGL2 path is the one Ruken declares and must stay at parity.
- Risk: the 3D package is a beta from an invited program (MIT licensed) whose terms, as The Last Light records them, keep builds inside the beta with no public deployment. Decision D-1 (provisional) keeps `render-pixi3d` unpublished and out of public game builds until that changes; a published package also cannot depend on a `file:` tarball.
- Revised 2026-10-11 after audit: WebGL2 is the default renderer (FloorFifty forces WebGL for mobile reach; Ruken's manifest has no WebGPU value).
