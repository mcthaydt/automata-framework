# S4: PixiJS 8.21 on WebGPU and WebGL

- **Question:** Does Pixi 8 run the same custom post filter (Bayer dither, GLSL + WGSL) on WebGPU and WebGL with matching output, and handle a 5k-sprite load?
- **Method:** `spikes/s4-pixi/*` through `run-page.ts`, headed Chromium.
  - A static frame of 16 gradient bars through `ditherFilter(8)`.
  - The positive control is `?dither=0`.
  - A stress test moves 5,000 tinted sprites for 300 frames.
- **Run:** 2026-10-01, M1 Mac, Playwright 1.63 Chromium.

## Results
- **WebGPU obtained:** yes. GPU strings: `apple metal-3` and `ANGLE (Apple, ANGLE Metal Renderer: Apple M1…)`. The dither filter compiles on both backends, and both runs reported `backend === requested`.
- **Pixel diff, WebGPU vs WebGL:** ratio **0** (31 colours each).
- **Positive control, dithered vs plain:** ratio **0.38**, so the filter really ran.
- **FPS with 5k sprites:**

  | Setup | FPS |
  |---|---|
  | WebGPU | 60 |
  | WebGL | 60 |
  | Pixel 7 profile at 4× CPU (WebGL) | 55 |

- **The trap this spike found:** taking pixel position from `gl_FragCoord` (GLSL) and `@builtin(position)` (WGSL) shifts the 4×4 pattern, because GL counts y from the bottom and WebGPU from the top; on the 270-row canvas the pre-run diff was 13%. Passing pixel position from the vertex stage (`aPosition * uOutputFrame.zw + uOutputFrame.xy`) gives an exact match.

## Verdict
**PASS.** Custom filters written as GLSL + WGSL pairs produce pixel-identical output on both backends, and Pixi holds 55–60 FPS with 5k sprites, including on the throttled phone profile.

## Consequences for A2/A4
- Every Pixi post effect ships as a GLSL + WGSL pair using Pixi's global filter uniforms (`uInputSize`, `uOutputFrame`, `uOutputTexture`).
- **Screen-space effects take pixel position from the vertex stage**, never from `gl_FragCoord` or `@builtin(position)`. This rule goes into the A4 post-process stack and its visual goldens (dither, LCD, grain, outline).
