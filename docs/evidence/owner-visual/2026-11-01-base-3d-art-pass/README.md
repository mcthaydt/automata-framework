# base-3d art pass: acceptance images (2026-11-01)

Spec: [2026-11-01-base-3d-art-direction.md](../../../superpowers/specs/2026-11-01-base-3d-art-direction.md). Plan:
[2026-11-01-base-3d-art-pass.md](../../../superpowers/plans/2026-11-01-base-3d-art-pass.md). Before this pass:
[`../2026-10-31-free-base-3d-quality/`](../2026-10-31-free-base-3d-quality/) and the "3D now" panels of
[`../2026-11-01-base-3d-art-direction/`](../2026-11-01-base-3d-art-direction/).

Each image is Emberwick (2D, left) beside base-3d (this PR, right) at the same viewport. Captured in headless Chromium
on SwiftShader from production builds (`vite build`) served statically; WebGL2.

| File | Viewport | 2D | 3D |
|---|---|---|---|
| `01-start.png` | 1280×720 | New game, Wick at the spawn | New game, Wick at the spawn |
| `02-channel.png` | 1280×720 | Wick at the start (the held jump did not register headless, so this is the start again) | W held 1.7 s: Wick walking toward the first lava channel |
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

- **Saturation.** The 2D frame is a richer mid-blue; the 3D stone still reads grey-blue between the pools of light.
- **Stone on screen.** The 25° camera looks mostly at the floor, so stone covers more of the frame than the 2D's
  platforms do, even with the grass and moss.
- **Wick from behind.** His eyes and face glow face away from the camera most of the time; the hood points read small.
- **No bloom.** Glow is additive cards (as Emberwick fakes it); there is no real bloom filter (the spike's limits).
- **Near-field noise.** Close to the camera the 32 px moss reads as busy specks.
- **2D at phone sizes** crops its bottom row, so Wick is off-screen in `06` and `08` (Emberwick's own framing).
- **G3-x over budget.** The portrait journey G3-x fails at 31.6–31.7 s (three runs) of its 30 s budget with the
  full-frame view; the same scene letterboxed passes at 26.6 s. The full-frame view resizes on each rotation. The budget
  is not raised; this is the coordinator's call. A frame of play itself costs about 115 ms on this software renderer
  (it was about 190 ms before the island, against #373's 90 ms).
- **Not measured:** WebGPU (no WebGPU headless here), the GPU runner's frame budget, real devices, hearing the sounds.

## Gates

See the PR body. The route golden is unchanged (`c735b5acacbbc716`); the sim is untouched.
