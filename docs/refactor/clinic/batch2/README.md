# The clinic in level3d: batch 2 (2026-11-11), in progress

Branch `claude/clinic-2`, stacked on `claude/clinic-1` (draft PR 596). The Owner judges on the side-by-side frames
`<frame>-compare.png`: the source's baseline | AF WebGL | AF WebGPU (the source's baselines exist for the four play
spots only and show its HUD). `shots.json` holds the facts of the last run of `spikes/clinic/shoot.mjs`
(`ONLY=<stem>,… node spikes/clinic/shoot.mjs <dir>` shoots part of the set).

## Items

| # | Item | State |
|---|---|---|
| 1 | The framing | Done. The difference was the camera, not the lens: the hall zone's own `look` (0, 1.1, 0.75), `follow` 0.12 and `depthFollow` keep the shot off the player (she stands low in the frame), while batch 1's spike put the look on her. The frames now shoot the zone's own play shot, with the framework's 5% letterbox bars off (they cropped 76 px of every frame). Home heading: see below |
| 2 | The WebGPU play camera | Done. The camera did reach the view; every WebGPU frame after the first was rejected (below), so the canvas kept the first one |
| 3 | The frame artefacts | The black line at 77% and the blue band at the bottom went with the framing (the line was a near wall's top crossing the frame; the band, the sky past a cut wall). Blue still shows past the building where the other rooms are not hidden: item 4 |
| 4 | Room visibility on the clinic's zones, wall tops back | Waits for PR 588 (room-visibility), still an open draft |
| 5 | The 12 world-kit pieces | Started: translucent parts (`veil`) in the builder and the view |
| 6 | Procedural props instead of the stand-in boxes | Not started |
| 7 | "On" frames | Waits for PRs 588 and 590 |

## Calls made

- **Home heading is `HOME_HEADING`, not a flipped geometry.** The Owner asked the rig's eye to stand south (+z) at the home
  heading, as the source's does (`presetOffset` z and `eyeOf`). Flipping those alone would put the stick's up toward the
  camera: `mapStick`'s forward is `(sin h, cos h)`, a sim function with a golden hash and a parity test, and the heading
  convention ("0 looks toward +z") is written in about fifteen places and in `base-3d` and `3d-story`. So `START.heading` is
  half a turn: a player's camera starts south looking north and stick-up is −z, with the sim's maths and the hashes of
  games that set `yawDeg` (`base-3d` does) unchanged. A literal flip is a separate change, for the Owner to ask for.
  A zone's `x` skew is authored for heading 0, so the clinic converter mirrors it about the look.
- **The WebGPU camera was not the camera.** `@pixi/3d` keeps one global bind group per view. A pass that samples a depth
  texture (every `PostEffect` does by default, used or not) leaves it bound in the opaque-depth slot; the next frame's
  opaque pass attaches the scene's depth writable under the same binding, and WebGPU rejects the whole command buffer
  (`Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
  synchronization scope`). 40 rejected buffers in 40 frames before, none after. It is the WebGL "Feedback loop" warning too.
  The fix is in `features/look/present-pass.ts`: the snap reads colour only, and a `PresentEffect` ends the look's passes
  whenever the haze or a pass after the snap runs, putting the engine's own empty depth back in the slot on WebGPU.
- **Shoots one browser a shot.** A closed WebGPU page took a shared browser's GPU process down in a long run.

## Not done here

Figures and their light (the FigureBuilder port) and bounce light (the EB look), as the brief says.
