# The default gameplay camera, from the base scenes

Owner, 2026-11-10: the default 3D gameplay camera of `@automata/3d` matches the reference game's. These are the base
interior and the base exterior through it, with a 1.62 m stand-in for the player in the middle of the room, at each of the
eight 45° steps of the player's turn (heading 0° looks toward +z, and each step is one press of the turn key).

- `<scene>-sheet.png`: the eight steps on one sheet.
- `<scene>-step<N>-<deg>deg.png`: one step, ×2 nearest.
- `shots.json`: what each frame drew (the renderer, the heading and distance, the console's messages).

Made by `spikes/tll-camera/shoot.mjs` (WebGL, headless Chromium on SwiftShader; see the header there). The camera is the
game's default view, `cameraView('play')`: 50 mm lens, 30° down, 16 m back, focus 1 m above the feet, locked on.

## What to look at

- The horizon stays level and the pitch stays 30° at every heading; only the player turns the camera.
- The base interior (6 × 5 m) is small in the frame at 16 m: the reference game's 15 to 16.6 m distances suit its larger
  rooms. A level authors a distance per zone (`distance`, 3 to 20 m); `DISTANCE=10 node spikes/tll-camera/shoot.mjs <dir>`
  shows the base interior nearer.
- The base exterior is nearly black on its ground and walls: that is the light gap in `../gap.md`, not the camera.
- The near walls are cut away by the occluder rule as the heading turns, so the player is never behind one.
- The console lists a WebGL "Feedback loop" warning on every frame, from the look's post passes; it is in `shots.json` and
  is not caused by the camera.

## Rule to test

| Rule | Where it is tested |
|---|---|
| 50 mm lens, 30° home tilt, 16 m default, in every view | `tests/unit/camera/angled-camera.test.ts`, `tests/unit/entries/camera-view.test.ts`, `tests/unit/camera/sim/camera-view.schema.test.ts` |
| Follows the player; 0.3 m (portrait 0.2 m) dead zone; 1/7 s ease | `angled-camera.test.ts`, `tests/unit/camera/play-camera.test.ts` |
| A zone may hold a fixed angle (`follow` below 1): dead zone, bounded pan (2 m, portrait 4 m), `depthFollow` | `play-camera.test.ts`, `angled-camera.test.ts` |
| Zone data: `look`, `distance`, `x`, `follow`, `depthFollow`, `enterMargin` (0.25 m hysteresis) | `camera-view.schema.test.ts`, `play-camera.test.ts` (`viewAt`) |
| Eight 45° steps (a press, not a held tick); no automatic yaw, pitch or roll | `tests/unit/camera/sim/*.test.ts`, `angled-camera.test.ts` |
| Automatic framing is a push-in dolly only: 0.75 to 1×, at most 0.25× a second, lens unchanged, held under reduce motion | `play-camera.test.ts`, `angled-camera.test.ts` |
| Peek: an offset of at most 1.2 m, no rotation | `play-camera.test.ts`, `angled-camera.test.ts` |
| Gameplay shake: a screen translation, 3 px at most, none under reduce motion | `play-camera.test.ts`, `angled-camera.test.ts` |
