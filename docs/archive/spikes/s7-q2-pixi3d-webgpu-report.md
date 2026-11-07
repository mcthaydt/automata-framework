# Draft: Pixi 3D beta bug report, WebGPU draws a different frame than WebGL2 (S7-Q2)

**Status:** a draft for the Owner to file with the Pixi 3D closed beta (the agent does not file it). Evidence: the
S7 part 2 GPU run ([`docs/spikes/s7-pixi3d.md`](./s7-pixi3d.md), S7-Q2) and its captures in
[`docs/evidence/owner-visual/2026-10-30-s7-q10/`](../evidence/owner-visual/2026-10-30-s7-q10/). Until a beta fixes
it, AutomataFramework's 3D is WebGL2-only and WebGPU is not offered for 3D (the S7-Q2 default, open to the Owner's
call).

---

**Title:** `@pixi/3d` 0.1.0-beta.2: under WebGPU one wall of a lit box room is not drawn and Phong lighting is darker than under WebGL2

**Versions:** `@pixi/3d` 0.1.0-beta.2 (vendored from The Last Light); Chromium 153.0.8010.12 (ANGLE Metal, WebGPU adapter `apple | metal-3`) and WebKit 26.6 (WebGPU on Apple); Apple M1, macOS, a real GPU (no software rasteriser in any capture). Firefox 155 does not offer WebGPU, so it ran WebGL2 only.

**What we do:** the S7 spike's scene (AutomataFramework `spikes/s7-pixi3d/`, removed after the spike and kept in git history at `5bf53a87`), rendered twice from the same code, once on each backend: a lit room with a figure, a perspective camera (24 mm equivalent, 25° down, 5 m back), 1280×720. The frame is held (`still=2`) and read back. [Owner: attach the scene's minimal source here when filing; the agent has not re-read it.]

**Expected:** the two backends give the same frame within a small tolerance (we use: a channel differs by more than 2 on at most 0.5% of pixels, and no channel by more than 16).

**Actual:**

| Engine | Pixels differing by more than 2 | Share | Largest channel difference |
|---|---|---|---|
| Chromium (WebGPU ran) | 569,286 of 921,600 | 61.8% | 87 |
| WebKit (WebGPU ran) | 569,286 of 921,600 | 61.8% | 87 |

- Under WebGPU the right-hand side wall is not drawn at all.
- The floor and the other walls are darker: mean luma 103.5 under WebGPU against 119.9 under WebGL2, so the Phong lighting terms differ between the backends.
- Chromium and WebKit give identical numbers, so the difference is in `@pixi/3d`'s WebGPU path, not in a browser.
- No console error, page error or validation message is raised under either backend.

**Attachments:** `q2-chromium-webgl.png`, `q2-chromium-webgpu.png`, `q2-chromium-diff.png`, and the same three for WebKit (from the evidence folder above); the scene's source can be shared on request.

**Context that may matter:** the page runs under a CSP without `unsafe-eval`. We supply the four generated functions the WebGL2 and WebGPU uniform parsers would otherwise build with `new Function` (the "no-eval" shim the S7 spike describes), including the WebGPU UBO half. The shim raises no error, and the WebGL2 frame under the same shim is correct, so we believe the drawing difference is independent of it; we can re-run without the CSP if that helps.

**Questions for the beta:** is the WebGPU renderer expected to match WebGL2 for `Mesh3D` with Phong materials in this beta? Is a mesh being culled differently under WebGPU (the missing wall is the right-hand one in the captures)?
