# A 3D night that drew brighter than the day (2026-11-12, branch `claude/3d-night-regression`)

Two editor journeys stayed red after the editor's harness was fixed (`claude/editor-journeys-green`, c3533947):
`levels-3d-edit-reaches-the-game` (base-3d) and `new-3d-game-plays-its-edits` (a fresh `create-game --template 3d` game).
Both set the level's time to Night in Levels 3D and need the game's picture to be darker than by day (night < 0.8 × day).

Everything here ran on Chromium with SwiftShader (no GPU), Node 24 / 22.

## Reproduction

`spikes/3d-night-probe/base-3d-day-night.mjs` copies base-3d's content, sets the level's `time` (none for day, `night`), runs the game's
dev server over the copy as the journey does, plays to the room, waits 4 s, saves the canvas and prints its mean
luminance (the journey's measure). `spikes/3d-night-probe/template-day-night.mjs` does the same for a game made by
`automata create-game hall-game --template 3d` with its `node_modules` linked from base-3d's. `?renderer=webgpu` with the
`AF_WEBGPU=software` flags gives WebGPU; the WebGPU numbers below matched WebGL to three places, on frames that differ
pixel by pixel.

### Bisect (base-3d probe, WebGL; night / day must be below 0.8)

| Commit | Day | Night | Night / day | Frame |
|---|---|---|---|---|
| c749d77e3 (#584) | 0.301 | 0.203 | 0.67 | the room 5 m behind Wick: walls, crates, embers (`bisect-c749d77e3-*.png`) |
| ff50419db (#583, gameplay camera) | 0.118 | 0.107 | 0.90 | the room from 16 m, every pixel the fog's colour; crates black blobs (`bisect-ff50419db-*.png`) |
| 395565365 (#585, haze and sky) | 0.237 | 0.281 | 1.18 | a flat dither veil, lavender by day, green at night; no walls, crates as dark blobs |
| 7b6ce6ace (main today) | 0.237 | 0.280 | 1.18 | the same (`base-3d-before-*.png`) |
| this branch | 0.262 | 0.173 | 0.66 | walls, crates, orange embers, Wick; night blue and darker (`base-3d-after-*.png`) |

The template game on main: day 0.198, night 0.197 (1.00); the room is there but under one veil, green and opaque at night
(`template-before-*.png`). On this branch: 0.170 / 0.132 (0.77), the room in its own colours, the far wall fading
(`template-after-*.png`). "A flat green dither with no walls or crate" is what main's base-3d night frame is.

## The causes (three, each flips a probe alone)

1. **#585: the haze was never focused on the gameplay camera.** `HazeEffect` counts from a focus; the renderer never set
   it, so it stayed at the profile's first-person `focusFp`, 3 m from the eye. Under #583's 16 m camera everything framed
   is at least 13 m from the eye, past the haze's far edge (10 m beyond the focus), so every pixel took the full amount
   and the frame became the veil. The spike that drew the haze (`spikes/eb-look/scene.ts`) calls
   `haze.focus(distance)`; `createPixi3dRenderer` did not. Template probe with only this change: 0.170 / 0.144 (0.85):
   the room reads again, but the night's far wall is still green.
2. **#585: a time with no haze of its own took the profile's day colour, unlit.** `night`, `lampLit` and `bar` set no `haze`
   (`times.json`), so `hazeOf` gave them the profile's #47655a at 0.85, against the day's own #8690b2 at 0.35: a brighter
   veil on a darker room. Template probe with only this change: 0.198 / 0.143 (0.72). The renderer already lights the
   fog's colour by the time (`lightByTime`); the haze's fallback now does the same.
3. **#583, base-3d only: the fog was set for the old camera.** base-3d's `FOG` was 5 to 14 m from the eye, for the 5 m
   camera; at 16 m the whole room is past full fog, so the time of day only tinted one colour. At ff50419db with only
   `FOG` at 16 / 25 m: 0.228 / 0.157 (0.69). (`examples/3d/look/look-pixel-art.ts` had the same defect and was already
   repaired to 16 / 30 m.) The template draws no fog.

The 3D package's `time-of-day.parity` test passed throughout because it draws with no look (no haze) and a fixed camera
5 m away; base-3d's journeys check the sim and the page's words, not the picture's time.

## The fix

- `packages/3d/src/app/haze-focus.ts`: `hazeFocusHooks` tells the haze, each frame after the camera moved, how far the
  rig's look point is from its eye; `createPixi3dRenderer` adds it when there is a camera and a haze pass.
- `packages/3d/src/features/look/haze.ts`: `hazeAt(profile, time)` is the time's own haze, or the profile's colour lit by the
  time when the profile marks it `lit` (only the library's own default does; a colour a game writes is used as given, see
  the implementation audit's M1); `createLookPasses` uses it. (`hazeOf` and the public API are unchanged.)
- `games/base-3d/src/features/scene/scene.ts`: `FOG` starts at `CAMERA_DEFAULTS.distance` and is full 9 m beyond.

Tests, each failing on main first: `tests/unit/look/haze.test.ts` (`hazeAt`), `tests/unit/app/haze-focus.test.ts`,
base-3d's `tests/unit/scene/scene.test.ts` (the fog starts no nearer than the camera stands, 5 against 16 on main), and
the guard below.

`SkyEffect` (`sky-pass.ts`) takes its below-horizon colour from `hazeAt(DEFAULT_LOOK.haze, time)` too, so it follows the
same rule. Nothing draws it today.

## The guard

`packages/3d/tests/browser/parity/look/gameplay-time.parity.test.ts` draws the template's room in miniature (its swatch
colours, its sky and ground) through `DEFAULT_LOOK` and the default gameplay camera following the player, by day and by
night: the night must be below 0.8 × the day, and the crate must change its pixels by more than 0.1 in both. On main:
0.91, and the crate 0.17 by day, 0.075 at night (fails both). On this branch: 0.64; 0.22 and 0.12. It is in the 3D
package's `browser` project, which `pnpm test:browser:3d` runs: the "3D - parity (chromium, webkit, firefox)" job of
`.github/workflows/3d.yml`. The editor's two night journeys (the fresh template game, played) run in the editor's
journeys step.

## The Last Light, after the haze rule (M1 ruled)

A game's own haze colour is now used as given (`HazeProfile.lit`, above). Proved on a scratch worktree (not pushed): this branch
merged with `origin/claude/last-light-prologue` (one conflict, in `create-renderer.ts`, resolved by keeping both the
prologue's `width` and `drawing` and this branch's `hazing` line). The game's `frames.test.ts` (`AF_SHOOT`, 1024 by 768,
Chromium with SwiftShader) shot twice: before is main's behaviour (`hazeOf` in `createLookPasses`, no haze-focus hook), after
is this branch. In `last-light-play-before-after.png` and `last-light-cutscene-before-after.png` (before left, after right) the far
floor and the window's shafts keep the game's grey-green on both sides, and the far tile is not pink. Mean colour over the whole
frame, before then after: play (28.85, 33.21, 32.24) and (28.94, 33.28, 32.28); cutscene (30.91, 34.10, 31.09) and
(30.80, 33.99, 30.99); over the far band of the frame the same to 0.3 a channel. The film grain differs between any two shots,
so single pixels do. (With the first version of the fix, which lit every colour, the same frame went blue-lavender.) The
game's `lookOf` spreads `DEFAULT_LOOK.haze` and writes its own colour, which is why the library's mark is not carried by a copy.

## What moves

| Picture or number | Before | After | Verdict |
|---|---|---|---|
| base-3d play frames, every time of day | flat veil (`base-3d-before-*`) | the room (`base-3d-after-*`) | the fix |
| template game frames | one veil (`template-before-*`) | the room (`template-after-*`) | the fix |
| `examples/3d` `look-pixel-art` brightness (`tests/e2e/look-pixel-art.test.ts`) | bar `> 40`, read at whatever moment the canvas was first non-trivial: 50.7 (48.5 recorded) on main under the day veil; 38.9 to 43.3 on this branch | held at sim tick 600 (Wick standing, camera settled; the page's clock in the test's hands): 40.35 healthy (three runs 40.3505, 40.3494, 40.3505), 19.61 with the fog at 5 to 14 m (three runs); bar `> 30` | **the expectation moved, 40 to 30, and the way it is read.** 40 was measured through the day veil, which was the bug. Fails with the defect planted, passes with it removed |
| Sim hashes, goldens | | | none move (presentation only) |
| world-kit looks, The Last Light's look | | | not run here: anything using `look` with the angled camera, or Night / Lamplight, draws differently |

## Journeys and gates

| What | Result |
|---|---|
| The two night journeys, Chromium, with `claude/editor-journeys-green` merged in a scratch worktree (not pushed) | 4 passed, 4.7 m (2 workers): iPad `new-3d-game` 2.2 m, `levels-3d-edit` 2.3 m; phone 2.3 m, 2.4 m |
| `packages/3d` unit | 1,533 passed |
| `packages/3d` browser (Chromium) and webgpu (`AF_WEBGPU=software`), `--testTimeout=90000` as the gate runs | 50 passed, 2 skipped; 7 passed. With the default 15 s timeout on this 4-core machine, three tests timed out (the existing time-of-day test among them) |
| base-3d e2e (`base-3d`, `base-3d-dev`) | 14 passed |
| examples-3d e2e (`examples-3d`) | 21 passed, 1 failed (`look-pixel-art`, above) |
| 3d-story e2e | 14 passed |
| `TURBO_FORCE=true pnpm check` (after `git fetch origin main`) | lint, typecheck (56 tasks), boundaries, style, source-names passed; knip passed once the probes moved to `spikes/3d-night-probe/`; `test:unit` 66 of 66 tasks; `check:changesets` 0 problems |
| `pnpm build`, `pnpm api-report`, `pnpm api-index` (check mode), `pnpm secrets` (unshallowed) | all passed: 0 API breaks, 0 undocumented, no leaks in the full history. No changeset: `@automata/3d` and base-3d are private |
| `pnpm test:journeys:3d` | stops at once here: WebKit is not installed. Its Chromium instance alone (`journeys (chromium)`): 3 files, 16 tests passed, 36 s |
| Not run | WebKit, Firefox (not installable here), a real GPU; cross-engine parity of the haze change is the Owner's runners' |

## For the tracker

| Step | Status | Record |
|---|---|---|
| 3D night brighter than day (editor's night journeys) | Fixed, test first: the haze focused on the gameplay camera, a time with no haze lights the library's own haze colour, base-3d's fog moved out to the 16 m camera. Guard: `gameplay-time.parity.test.ts` in the 3D parity job | `docs/superpowers/audits/2026-11-12-3d-night-regression/` |
| A game's own haze colour (M1 ruled) | Done: `HazeProfile.lit`; only the library's default colour is lit by the time, a colour a game writes is used as given. The Last Light's play and cutscene frames are the same before and after (`last-light-*-before-after.png`). `SkyEffect` follows the same rule | same, "The Last Light, after the haze rule" |
| `examples/3d` `look-pixel-art` brightness (M2 ruled) | Done: read at sim tick 600 with the page's clock held; 40.35 healthy, 19.61 with the defect, floor 30 (was 40, measured through the day veil). Fails planted, passes removed | same, "What moves" |
