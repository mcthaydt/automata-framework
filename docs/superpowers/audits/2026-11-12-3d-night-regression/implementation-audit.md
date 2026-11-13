# Implementation audit: the 3D night regression (2026-11-13, branch `claude/3d-night-regression`)

Audited head 98dae4c78 against `origin/main` 7b6ce6ace. Chromium with SwiftShader (no GPU), Node 22/24, 4 cores. Every
number here was measured in this session; the probes that measured them were scratch copies of the tests named, not
committed.

## Verdict

The three causes are real and the fix is right for the framework's own games: base-3d, the template game and
`examples/3d-story` draw their rooms again, the night darker than the day. Two things stand in the way of a clean merge:

1. The branch turned a 3D browser suite red that the fix session did not run (`extensions/world-kit`
   `reflect.test.ts`). Fixed here (7728414c5), test only; see H1.
2. `hazeAt` re-lights *any* look's haze colour at a time with no haze of its own, including a colour a game chose for
   that time. The Last Light chose its haze for `lampLit` and its play frame moves (M1). This is a design question for
   the Owner before The Last Light merges, not a defect to patch here.

And one red test stays red for the Owner: `examples/3d` `look-pixel-art`'s brightness bar (M2).

**Ready to merge into main: yes, with M2 left red by the Owner's choice and M1 decided before The Last Light's branches
merge.** Pending the Owner's runners: WebKit, Firefox, a real GPU.

## 1. The causes and the fix, reproduced

### The guard's room (`gameplay-time.parity.test.ts`), mean luminance and crate contrast, every time of day

Measured with a scratch copy of the guard that prints instead of asserting. Identical to the last digit on two runs of
the branch: the draw is deterministic.

| Build | day | golden | dusk | night | lampLit | bar | night / day | crate day / night |
|---|---|---|---|---|---|---|---|---|
| main | 0.381 | 0.371 | 0.306 | 0.346 | 0.351 | 0.345 | 0.91 | 0.167 / 0.075 |
| focus hook only (main's `createLookPasses`) | 0.280 | 0.254 | 0.188 | 0.192 | 0.198 | 0.190 | 0.68 | 0.223 / 0.124 |
| `hazeAt` only (main's renderer) | 0.381 | 0.371 | 0.306 | 0.218 | 0.270 | 0.216 | 0.57 | 0.167 / 0.060 |
| branch | 0.280 | 0.254 | 0.188 | 0.180 | 0.185 | 0.178 | 0.64 | 0.223 / 0.120 |

- Cause 1 (focus) is real and alone sufficient to pass the editor's night measure here; `hazeAt` alone leaves the
  crate under the veil (0.060 at night).
- Cause 2 (the unlit day-colour veil) is real: with the focus fixed, `hazeAt` takes the night from 0.192 to 0.180 and
  turns the far wall's green into the time's colour. Day, golden and dusk set their own haze and are unchanged by it.
- Cause 3 (base-3d's fog): `FOG.near` is now `CAMERA_DEFAULTS.distance` (16 m), and the framing dolly only pushes in
  (0.75 to 1 times the distance), so the player is never fogged. The unit test checks every view of the room.

`hazeFocusHooks` focuses on `|eye - look|`. The look point is on the view axis, so that is the look point's view
depth, which is what the shader's `viewDepth` compares. It runs after `cameraDriver` and the occluder rule in
`mergeHooks`, on the pose they wrote. Nothing calls `focusCentre`, and the angled rig has no orthographic mode, so
`focus` resetting `uOrtho` to 0 every frame changes nothing today (an orthographic rig would need the hook to call
`focusCentre`; noted, L3).

### The frames, looked at

- `base-3d-before-*`: every pixel is the veil's dither, lavender by day and green by night; the crates are dark blobs,
  no walls, no embers. Night is lighter than day. Confirmed.
- `base-3d-after-*`: the room's walls, floor, crates, orange embers and Wick; night is blue and darker; the far wall
  at night keeps a teal tint (the lit profile colour, past the focus), as expected from `hazeAt`.
- `template-before-night` / `template-after-night`: one green veil over the room, then the room in its own colours with
  the far wall fading to blue. Confirmed.
- `look-pixel-art-before` / `-after`: the floor flat and lighter under the day veil; then the floor in its own dithered
  swatch and Wick sharper. Confirmed.

### The laws

No sim file changed (`git diff origin/main --stat` touches `packages/3d/src/app`, `features/look`, base-3d's scene
view, tests and docs). `hazeFocusHooks` reads the camera's pose and writes one uniform. No hash or golden moved: the
3D package's figure goldens and the wardrobe goldens draw without a look and passed.

## 2. The guard

On main it fails both tests for the right reason (night 0.346 against a bar of 0.305; the crate 0.075 at night). On the
branch it passes (0.64; 0.22 and 0.12). It is not tuned: each bar sits between main's value and the branch's, and the
comment records both.

Two weaknesses, neither a reason to hold the merge:

- With the focus hook in place, it does not catch cause 2 alone: dropping `hazeAt` keeps it green (0.68; 0.124 at
  night). Cause 2 is held by the unit test `haze.test.ts` (`hazeAt` lights the profile colour), not by a picture. (L1)
- The crate's night bar (0.1) is 20 % under SwiftShader's 0.12. WebKit and Firefox may land nearer; if the Owner's
  runner reads below 0.1 there, that is a finding about the engines, not a reason to lower the bar. (L2)

## 3. What moved that the session did not check

| What | Drawn with | Moves? | Evidence |
|---|---|---|---|
| `extensions/world-kit` `reflect.test.ts` (3D browser suite, `3d.yml`) | look, night, fixed camera | **red on the branch, 2 of 3**; fixed in 7728414c5 (H1) | passes on main, fails on the branch, fails with `hazeAt` alone |
| world-kit's other browser tests (`passes`, `shafts`, `particles`, `ward`) | look, night | pictures move (lit veil), tests pass | the suite: 28 of 30 at 98dae4c78 (the two `reflect` tests), 30 of 30 after 7728414c5 |
| `extensions/character-kit` browser (`gate-lit` at `lampLit`, `stage-scene`) | look, `lampLit` / day | pictures move at `lampLit`, tests pass | 55 passed, 2 skipped |
| `SkyEffect` (`sky-pass.ts`) | its own fallback: `time.scene.haze?.colour ?? DEFAULT_LOOK.haze.colour`, unlit | not changed by the fix; same unlit day colour below the horizon at night | used by no game or example; L4 |
| Template (`create-game --template 3d`) | look, angled camera, no fog | moves (the fix) | the night journeys, below |
| `examples/3d-story` | look, angled camera, day | moves: the room is no longer under the veil | e2e below |
| `examples/3d` with look and the angled camera (`look-pixel-art`, `figures-clips`, `characterkit-painted`, `cutscenes-*`) | | move (the veil lifts) | `look-pixel-art` red (M2); the rest pass |
| `examples/3d` `worldkit-sky` | look, night | moves (lit veil) | e2e passed |
| The Last Light (`claude/last-light-camera`, trial merge) | its own haze colour at `lampLit`, `focusFp` = the view's distance | **play frame moves**; cutscene frame barely (M1) | `last-light-play-before-after.png`, `last-light-cutscene-before-after.png` |
| `claude/last-light-ada` | same game, same look | same as above (same `look.ts`, same `TIME`) | not shot separately |

### The Last Light (M1)

Trial merge of `claude/last-light-camera` (d761f87c3) into this branch in a scratch worktree, not pushed. One conflict,
in `create-renderer.ts`, where the camera branch adds `width` and `drawing` to `occluderHooks` beside the new `hazing`
line; it resolves by keeping both. The game's frames shot with its own `frames.test.ts` (`AF_SHOOT`, 1024 by 768), with
the fix and with only the fix's two source changes reverted:

- Play (`last-light-play-before-after.png`, before left): the far floor and the window's light shafts go from the
  game's grey-green haze to a blue-lavender, and the far tile turns pink. Mean luma 36.2 to 37.3 (the film grain moves
  between shots, so most pixels differ either way).
- Opening cutscene (`last-light-cutscene-before-after.png`): no change the eye can find; the shot is close.

Why: The Last Light's whole night is `lampLit`, which sets no haze. Its `lookOf` sets the haze colour to the old game's
fog, converted (`hazeColourOf(0x4b5a56)`), at amount 1 and glow 0, to match the old game's frames. `hazeAt` now treats
that colour as a day colour and lights it by `lampLit` (dimmed, pulled toward the time's grade tint). The framework
already overrides a game's haze colour at day, golden and dusk (`hazeOf` takes the time's colour), so a game has no way
to say "this is my night's haze, as is".

The game's own focus fix (`focusFp: PLAY.views[0].distance`) does not fight the hook: the hook gives the same distance,
or less while the framing pushes in. During a cutscene the camera branch's `drawing` tells the occluder rule which shot
draws; the haze hook still reads the play rig. The game's cutscene frame shows this is no worse than before (the focus
was the play distance then too), but when the camera branch merges the hook should follow `drawing` as the occluder
rule does.

## 4. `look-pixel-art`'s brightness bar (M2)

What it protects (`ee8abe879`, 2026-11-11): the example's fog had started at 5 m under the 16 m camera, painting the
whole frame in the fog's colour. The bar (`> 40`) separates "the floor and Wick in their own colours" from "the fog
everywhere". The 48.5 it was written against was measured on main, with the unfocused day veil over the floor.

Measured here, a sample every 0.4 s for 30 s from the first frame, with a scratch copy of the test:

| Build | First frame | Range over 30 s | Wick's blue pixels (middle third) |
|---|---|---|---|
| main | 45.6 | 45.6 to 50.9 | 60k to 78k |
| branch | 38.9 | 38.9 to 43.3 | 57k to 73k |
| branch, the example's fog put back to 5 to 14 m (the defect the bar guards) | 19.2 | 19.2 to 20.4 | 0 |

- 50.7 was the day veil, not the scene: the same frame drops by 6.7 when the veil is focused, and the floor is the
  same floor. The veil raised it.
- Why it varies: the value is a smooth function of when it is read, the same shape on main and on the branch (rise to
  a peak about 13 s in, fall, rise). Wick walks an 11 s loop and the camera's automatic framing dollies in and out
  (up to 0.25 of the distance a second, eased on the frame clock), so how much of the frame is floor, and Wick's size,
  depend on the moment. The test reads the canvas once, as soon as more than three colours show, which lands at a
  different moment on each run (load time on a shared runner). The draw itself is deterministic; the moment is not.
  On main the whole curve sat above 40, so the variance never showed.
- The guard still separates cleanly: 38.9 at worst against 20.4 at worst for the defect.

Choices for the Owner (I changed neither the assertion nor the example):

1. Leave it red until the new example set replaces this example. Truthful: the bar is set on a veil that no longer
   exists, and the test reports that.
2. Put the bar where the measurements put the boundary (for example 30, between 20.4 and 38.9), citing these numbers.
3. Measure what the bar means rather than the mean: Wick's blue pixels (0 under the fog, over 50k in every sample), or
   the share of pixels in the fog's colour.
4. Read at a fixed state: with reduced motion (the framing does not ease) at a stated tick, so the value is one number.

My recommendation: 1, since the example is due to be replaced; if it must be green sooner, 3, which tests the thing the
comment says it tests.

## 5. Gates, rerun uncached

Branch head 7728414c5 unless said. All on this 4-core container, Chromium with SwiftShader.

| What | Result |
|---|---|
| `TURBO_FORCE=true pnpm check` | exit 0: lint, typecheck (56 of 56 tasks, 0 cached), boundaries, style, source-names, knip, `test:unit` (66 of 66 tasks, 0 cached), `check:changesets` (79 changesets, 0 problems) |
| `TURBO_FORCE=true pnpm build` | 16 of 16 tasks, 0 cached |
| `packages/3d` browser (Chromium) and webgpu (`AF_WEBGPU=software`), `--testTimeout=90000` | 17 files; 57 passed, 2 skipped |
| `extensions/world-kit` browser (Chromium) | 30 of 30 after 7728414c5 (28 of 30 at 98dae4c78; 3 of 3 `reflect` on main) |
| `extensions/character-kit` browser (Chromium) | 55 passed, 2 skipped |
| base-3d e2e (`base-3d`, `base-3d-dev`) | 14 passed (1.8 m) |
| 3d-story e2e (`story-3d-phone`, `story-3d-ipad`) | 14 passed (2.1 m) |
| examples-3d e2e (`examples-3d`) | 21 passed, 1 failed: `look-pixel-art`, 38.93 against `> 40` (M2) |
| The two night journeys, Chromium, iPad and phone, on a scratch merge with `claude/editor-journeys-green` (39e33659d, not pushed, `pnpm build` first) | 4 passed (3.7 m). A first run while `pnpm check` loaded every core failed 2 of 4 at the 30 s wait for the first lit picture, each passing at the other size; rerun quiet, all passed |
| The Last Light `frames.test.ts` on a scratch merge with `claude/last-light-camera` (a0aa12af2, not pushed) | shot with and without the fix (M1) |
| Not run | WebKit and Firefox (not installed here), a real GPU, `claude/last-light-ada` (same `look.ts` and time as the camera branch), The Last Light's own journeys |

## Findings

### High

- **H1. The branch turned world-kit's `reflect.test.ts` red (2 of 3, Chromium), in the 3D browser suite.** Under the
  lit night veil the white ball snaps to ramp 10's lightest (#ebf0f6), not ramp 0's (#f5f7fa); under main's day-green
  veil it drew mostly ramp 0 (and the frame carried #47655a, the bug itself). The pass still mirrors one step down
  the ball's own ramp (#bac7db); the test had ramp 0's step written in. **Fixed (7728414c5)**: the test reads the ball's
  colour from the dry frame. It passes on main and the branch and fails when `PUDDLE_STEP` and `WET_STEP` are swapped.

### Medium

- **M1. `hazeAt` re-lights a game's chosen haze colour.** The Last Light's play frame moves (above). The Owner's choice:
  (a) light only the library's default colour and leave a game's own as given; (b) a profile field saying the colour
  is already the time's (`lit: false`, schema change); (c) The Last Light compensates in its own `lookOf`. Not changed
  here: each option changes behaviour the Owner owns, and the trial merge is the only place it shows.
- **M2. `look-pixel-art`'s brightness bar is red, intermittently** (38.9 to 43.3 against 40). Not a regression in the
  scene: the bar was set on the veil. Choices above; left for the Owner.

### Low

- **L1.** The guard does not catch cause 2 alone once the focus is right; the unit test does.
- **L2.** The guard's night crate bar has a 20 % margin on SwiftShader; WebKit and Firefox are unmeasured.
- **L3.** `hazeFocusHooks` always calls `focus` (perspective). Right for the angled rig, the only rig the renderer
  makes; an orthographic rig would need `focusCentre`.
- **L4.** `SkyEffect` keeps the same unlit fallback below the horizon. Nothing draws it today; it should follow
  whatever M1 decides rather than `hazeAt` as it stands, so it is left alone.
- **L5.** The fix's README says "Night and Lamplight" have no haze; the library's names are `night` and `lampLit`, and
  `bar` has none either (it is lit the same way). Its "What moves" table lists world-kit and The Last Light as not run;
  they are now (above).

## For the tracker

| Step | Status | Record |
|---|---|---|
| 3D night regression: implementation audit | Done. Causes and fix reproduced (night / day 0.91 to 0.64 in the guard's room); guard fails on main for the right reason. One red suite the fix caused (world-kit `reflect`) fixed test-only in 7728414c5 | `docs/superpowers/audits/2026-11-12-3d-night-regression/implementation-audit.md` |
| `hazeAt` and a game's own haze colour (The Last Light at `lampLit`) | Owner's decision before The Last Light merges: light only the default colour, a `lit` field, or the game compensates | same, M1; `last-light-*-before-after.png` |
| `look-pixel-art` brightness bar | Red, intermittent (38.9 to 43.3 against 40); the bar was set on the day veil. Owner: leave red until the new example set, or bar 30, or count Wick's pixels | same, M2 |
| Haze focus during a cutscene shot | When `claude/last-light-camera` merges, `hazeFocusHooks` should follow `drawing` as the occluder rule does | same, §3 |
| Cross-engine | WebKit, Firefox, GPU runs of `gameplay-time.parity` and world-kit `reflect` | the Owner's runners |
