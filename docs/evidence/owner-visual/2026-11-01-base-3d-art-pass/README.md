# base-3d art pass: acceptance images (2026-11-01)

Spec: [2026-11-01-base-3d-art-direction.md](../../../superpowers/specs/2026-11-01-base-3d-art-direction.md). Plan:
[2026-11-01-base-3d-art-pass.md](../../../superpowers/plans/2026-11-01-base-3d-art-pass.md). Before this pass:
[`../2026-10-31-free-base-3d-quality/`](../2026-10-31-free-base-3d-quality/) and the "3D now" panels of
[`../2026-11-01-base-3d-art-direction/`](../2026-11-01-base-3d-art-direction/).

Each image is Emberwick (2D, left) beside base-3d (this PR, right) at the same viewport. Captured in headless Chromium
on SwiftShader from production builds (`vite build`) served statically; WebGL2. Recaptured on 2026-11-01 by lane 2 at
`5287e089` (the 3D half; the 2D half is the earlier capture, Emberwick is unchanged): the view drawn at most 360 px tall
and nearest-upscaled, the stone coloured per vertex in palette cells, Wick's back fill, the 128 px moon and the blue
ambient. The capture script (`capture.mjs`: build, serve, New game, wait for tick 5, optional key hold or pause, 1.5 s,
screenshot) and the pairing script (`pair.py`) are in the lane's scratchpad, not committed.

| File | Viewport | 2D | 3D |
|---|---|---|---|
| `01-start.png` | 1280×720 | New game, Wick at the spawn | New game, Wick at the spawn |
| `02-channel.png` | 1280×720 | Wick at the start (the held jump did not register headless, so this is the start again) | W held 1.7 s: Wick walking toward the first channel |
| `03-ember-pickup.png` | 1280×720 | Wick touches the one ember: the end screen ("The ember is yours") | Spawned on the first ember: just taken, the HUD reads 1 |
| `04-goal.png` | 1280×720 | Spawned beside the ember | Spawned 2.6 m before the goal ember, the moon in the far arch |
| `05-pause.png` | 1280×720 | Pause panel | Pause panel |
| `06-phone-844x390-start.png` | 844×390 | Start | Start |
| `07-phone-844x390-goal.png` | 844×390 | Beside the ember | Before the goal |
| `08-phone-780x270-start.png` | 780×270 | Start | Start |

How the moments were reached: the ember and goal frames use throwaway spawn patches (the level file's `spawn`, and
Emberwick's `P` tile), built to a scratch directory and reverted at once; nothing patched is committed. Headless
keyboard walking was unreliable, which is why spawns are used.

## Every element of the 2D scene, and its 3D counterpart (spec §2)

Present in 3D: an open moonlit night (the ruin floats in it, so the sky shows above, beside and below): a large moon
high on the right, silhouette islands of pines and ruined towers, stars and moonlight shafts; mossy stone platforms with
bright grass tufts on every edge, vines down the ledges; low broken walls; glowing mushrooms that light the stone cyan;
the channels as gaps onto the sky with cool glowing rims (no red: Emberwick has none); embers that glow, pulse, throw
sparks and carry their own light; the goal with a column of light and rising sparks; fireflies; Wick in the sprite's lit
blue with hood points, a cool rim light over his hood and a warm lantern pool. The view fills the page at any shape.

## Where 3D still falls short (honestly)

- **Floor share.** The 25° camera still looks mostly at the platform tops. They now read as Emberwick's moss and
  blue-violet stone in palette cells, not noise, but they fill more of the frame than the 2D's thin grass strips do.
- **Wick's face.** From behind he reads in his cloak's blue now; his face and eyes still face away most of the time.
- **The pause button over the moon** (`04`): the button's white icon is lost where the moon sits behind it.
- **No bloom.** Glow is additive cards (as Emberwick fakes it); there is no bloom filter yet.
- **2D at phone sizes** crops its bottom row, so Wick is off-screen in `06` and `08` (Emberwick's own framing).
- **Not measured:** WebGPU (no WebGPU headless here), the GPU runner's frame budget, real devices, hearing the sounds.

G3-x passes with the cap: 18.0, 18.1 and 11.3 s (three runs) and 11.7 s in the full base-3d run, against 32.3 (fail),
32.2 (fail) and 23.5 s for the same scene uncapped on the same container. The 30 s budget is unchanged.

## Gates

See the PR body. The route golden is unchanged (`c735b5acacbbc716`); the sim is untouched.
