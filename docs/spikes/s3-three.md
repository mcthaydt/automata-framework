# S3: Three.js r186 WebGPU → WebGL2 with TSL post-processing

- **Question:** Can one `WebGPURenderer` + `RenderPipeline` + TSL post effect (Bayer dither) run on both the WebGPU and WebGL2 backends with matching output?
- **Method:** `spikes/s3-three/*` through `run-page.ts`, headed Chromium.
  - Five flat-shaded icosahedra; `?backend=` picks the backend.
  - The positive control is `?dither=0`.
  - Captures are compared with `compare.ts`, which rejects any image with fewer than 8 colours.
- **Run:** 2026-10-01, M1 Mac, Playwright 1.63 Chromium (headed) and WebKit.

## Results
- **WebGPU obtained:** yes.
  - GPU strings: WebGPU `apple metal-3`; WebGL `ANGLE (Apple, ANGLE Metal Renderer: Apple M1…)`. These are real GPUs, not a software fallback.
  - Both runs reported `backend === requested`.
- **Pixel diff, WebGPU vs WebGL2 (dithered):** ratio **0**, 0 of 129,600 pixels differ, 429 colours each. The pass bar is ≤ 0.01.
- **Positive control, dithered vs plain:** ratio **0.77**, so the dither pass really ran (it must be ≥ 0.05).
- **FPS** (recorded, not gated; capped by rAF):

  | Setup | FPS |
  |---|---|
  | Chromium, WebGPU | 60 |
  | Chromium, WebGL2 | 60 |
  | Pixel 7 profile at 4× CPU | 57 |
  | WebKit, WebGL2 (`Apple GPU`) | 56 |

- **Headless capture:** headless Chromium on macOS renders WebGPU but captures its canvas as solid black, so captures run headed. Visual goldens on the A3 Linux runner must verify their own capture path.

## Verdict
**PASS.** The same TSL post effect produces pixel-identical output on WebGPU and WebGL2, runs on a real GPU in Chromium and WebKit, and holds 56–60 FPS in every recorded setup.

## Consequences for A2/A4
- The post-process stack is authored once in TSL for both backends. Typed usage: `vec4(bayerDither(scenePass.rgb, float(8)), 1)`.
- Backend selection: WebGPU by default, `forceWebGL` when no WebGPU adapter is available. Ruken's renderer enum lists only WebGL variants, so the WebGL2 path is mandatory and must stay at parity.
- Visual goldens: verify a non-blank capture method for WebGPU on the A3 runner before trusting WebGPU screenshots. The `compare.ts` colour floor catches black captures.
