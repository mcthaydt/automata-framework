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

Present in 3D: night sky and haze fog in Emberwick's palette entries; dim moonlit fill and moonlight from the far end;
moon (in the far arch, framed above the goal); ruined towers and pine silhouettes beyond the walls; moonlight shafts;
mossy stone platforms with grass at every edge and wall foot; vines down the channels; glowing mushrooms that light
the walls cyan; embers that glow, pulse, throw sparks and carry their own warm light; the goal with a column of light
and rising sparks; fireflies; Wick's lantern. New in 3D: lava that lights the channels red.

## Where 3D still falls short (honestly)

- **Overall brightness and blue.** The 2D frame is a luminous mid-blue; the 3D frame is darker and greyer, with the
  colour carried by pools of light rather than by the whole picture. The stone reads grey-blue, not Emberwick's blue.
- **The sky is a thin band.** The camera looks 25° down (35° at the goal), so the moon, stars and towers show only at
  the far end and through the arch; in the 2D game they fill the top third of every frame.
- **No bloom.** Glow is additive cards (as Emberwick fakes it); there is no real bloom filter (the spike's limits).
- **Wick is dark.** The procedural figure in its dark blue cloak reads as a silhouette with a lantern; the 2D Wick's
  bright hood and glowing eyes read at once. A rim light or a lighter cloak swatch is a follow-up.
- **Near-field noise.** Close to the camera the 32 px moss and grass textures read as busy specks.
- **Letterbox bars.** At 1280×720 the 3D game letterboxes to its 844×390 size in the runtime's purple-grey; Emberwick's
  page is the night colour. The bars come from the theme, not the scene.
- **2D at phone sizes** crops its bottom row, so Wick is off-screen in `06` and `08` (Emberwick's own framing).
- **Software rendering cost.** In headless Chromium here a frame of play costs about 190 ms against #373's 90 ms
  (rAF mean over 35 frames, 844×390, `fps.cjs` in the lane's scratchpad; lights about 30 ms, dressing about 20 ms, the
  rest spread over textures and geometry). The portrait journey G3-x passes at 28–30 s of its 30 s budget (it was
  31 s before the mushrooms were merged and the bays lengthened): a flake risk on a slower runner. Real GPUs are the
  target; the GPU runner's probe is the measure.
- **Not measured:** WebGPU (no WebGPU headless here), the GPU runner's frame budget, real devices, hearing the sounds.

## Gates

See the PR body. The route golden is unchanged (`c735b5acacbbc716`); the sim is untouched.
