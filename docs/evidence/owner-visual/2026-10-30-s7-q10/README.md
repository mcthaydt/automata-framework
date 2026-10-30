# S7 part 2 (M3.1b): GPU-runner captures, 2026-10-30

Captures from the S7 GPU run for the Owner's visual review: S7-Q10 (the angled 24 mm view on phones), S7-Q2 (WebGL2 against WebGPU) and S7-Q1 (the scene under Ruken's CSP). The numbers and verdicts are in [`docs/spikes/s7-pixi3d.md`](../../../spikes/s7-pixi3d.md) part 2; the raw results are in [`s7-results.json`](./s7-results.json).

- **Run:** GitHub Actions 41114454352, `5bf53a87` (`claude/3d-m3-1b-s7-gpu`), runner `af-mac` (Apple M1, real GPU, `software: false` in every capture).
- **Page:** the spike's `index-shim.html` (no-eval, then the AF-owned four-function shim) under Ruken's CSP; the held frame is `still=2`; the camera is 24 mm, 25° down, 5 m back.
- **Browsers:** Chromium 153.0.8010.12 (full, new headless; ANGLE Metal), WebKit 26.6, Firefox 155.0.
- **Unchanged:** these images are evidence, not goldens; nothing in the repo compares against them.

| Image | Question | What it shows | Result |
|---|---|---|---|
| `q10-16x9-scene.png`, `q10-4x3-scene.png`, `q10-21x9-scene.png` | S7-Q10 | The default view at 1280×720, 1024×768, 1680×720 | Followed figure 217, 231, 217 px tall: 30.1% of the frame (≥ 25%) |
| `q10-phone-844x390-scene.png`, `-scene-dpr3.png` | S7-Q10 | iPhone 13 sideways, CSS pixels and device pixels | 118 px tall (limit 97), 30.3% |
| `q10-compact-780x270-scene.png`, `-scene-dpr3.png` | S7-Q10 | Compact height, the Owner's legibility call | 81 px tall (limit 67), 30.0% |
| `q10-*-figure.png` | S7-Q10 | The followed figure alone (its measured box) | Heights as above |
| `q10-*-void.png` | S7-Q10 | The cleared-colour pixels (the void) | About 5% of the frame, a band along the top above the 3 m walls: the authored room and fog must close it (M3.4) |
| `q10-depth-near0.3-far120.png`, `q10-depth-near1-far30.png`, `q10-depth-diff.png` | S7-Q10 | Shipped depth planes against a tight pair | 2 pixels differ, both on the far/right wall seam; no z-fighting band |
| `q10-stretch-middle.png`, `q10-stretch-edge.png` | S7-Q10 | One figure at the middle and at about 80% of the half-width at 21:9 | Edge figure 2.44× as wide (151 px against 62), same height, leans outward: the 24 mm lens, recorded |
| `q2-chromium-webgl.png`, `q2-chromium-webgpu.png`, `q2-chromium-diff.png` | S7-Q2 | One held frame on each backend | **Fails:** 61.8% of pixels differ by more than 2, max 87; the right wall is missing under WebGPU and the lighting is darker |
| `q2-webkit-webgl.png`, `q2-webkit-webgpu.png`, `q2-webkit-diff.png` | S7-Q2 | The same in WebKit | Identical numbers to Chromium: the gap is `@pixi/3d`'s |
| `q2-firefox-webgl.png`, `q2-firefox-webgpu.png` | S7-Q2 | Firefox | WebGPU not offered; both ran WebGL2 (not compared) |
| `q1-chromium.png`, `q1-webkit.png`, `q1-firefox.png` | S7-Q1 | The scene under the CSP | 0 CSP events, 0 console errors, 0 page errors |
