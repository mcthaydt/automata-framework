# Merge trains, 2026-11-13

Nine finished, audited branches are merged in trains: one integration branch merges several of them, one pull
request runs CI once. Each member goes in with `git merge --no-ff` (real merges; no rebase, no squash, no
cherry-pick), so every member commit lands on `main` as it is. The merge session opens each train's pull request
and merges it with a merge commit.

## Train 1: `claude/merge-train-1`

Built from `origin/main` at `a234a3a20`. Members, in merge order, each at the remote head taken at build time:

| # | Branch | Merged head | Notes |
| --- | --- | --- | --- |
| 1 | `claude/evidence-tags` | `e1c2fffd7` | Skipped: already on `main` (pull request #670). |
| 2 | `claude/editor-journeys-green` | `d9437e94d746784988b60a7019ca3b4096fa58b7` | |
| 3 | `claude/default-screens-focus` | `0dc6fed1270dc17b433c97f0888405be329dd34e` | Clean: no PNG under `tooling/evidence/examples-index/`; the examples runner's screenshot-path fix (`0dc6fed12`) is present. |
| 4 | `claude/emberwick-journey-speed` | `800bede8e3ab75c1020c83033d7f742fb30ec2f7` | |
| 5 | `claude/typed-words-saved` | `cd01f69ddd6cccfdd1322212d69a939f9b0b6b69` | |
| 6 | `claude/desktop-games` | `ad54d8312258f8791e6103660de2ef8a97af7bc0` | |
| 7 | `claude/ship-docs` | `0470b938bd806c817da18996de98e5acafade661` | Docs only. |

No member changes a file under `.github/workflows`. No merge conflicted, so there are no resolutions to record.

## Train 2: `claude/merge-train-2`

Built on train 1's head (`f332d94db`), so it contains train 1. Members, in merge order, each at the remote head taken at
build time:

| # | Branch | Merged head | Notes |
| --- | --- | --- | --- |
| 1 | `claude/pixi-3d-public` | `4663e737e0d00f8f5e2bffa64f70e7eb356086de` | Carries reviewed workflow edits: `3d.yml` (drops the `vendor/pixi-3d/**` path trigger) and `site.yml` (comments only). |
| 2 | `claude/3d-night-regression` | `35f9a7da3376bf6a2543b717ee456102ea6fd2f4` | |
| 3 | `claude/painter-figure-look` | `c731157936cae267d6b42b84ce55185da777cf64` | Pull request #664. |
| - | `claude/default-screens-focus` | | In train 1, so not repeated here. |

No merge conflicted. The two branches that both touch `packages/3d/src/features/look/haze.ts`, `look-pass.ts`,
`sky-pass.ts` and `tooling/api-report/reports/3d.api.md` merged automatically, and the merged result keeps both intents:

- `haze.ts`: `HazeEffect` stages at `'afterToneMapping'` (pixi-3d-public) and `hazeAt` lights the default haze by the time (night).
- `look-pass.ts`: the pass takes `hazeAt(look.haze, time)` (night) and the comment on the stage stands (pixi-3d-public).
- `sky-pass.ts`: the sky takes its haze colour from `hazeAt(DEFAULT_LOOK.haze, time)` (night), divides by `abs(uFxClip.w)` (pixi-3d-public) and stages after tone mapping.
- `3d.api.md`: `pnpm api-report` in check mode passes on the merged tree, so the report is what the tool writes and nothing was regenerated.

### The one change on top of the merges

`extensions/world-kit/tests/browser/webgpu/effects.test.ts`, "a puddle mirrors the ball below it…", failed once both
branches were together (it passed on pixi-3d-public alone). The expectation named ramp 0's white, recorded under the unlit
night haze. `claude/3d-night-regression` lights the default haze by the time (deliberately: the night fix), so the ball's
snapped colour differs. The test now takes the colour from the dry frame, as `7728414c5` did for the WebGL reflection test;
the helper `ballStepsDown` moved into the sky tests' shared `support.ts`. What it guards (the puddle mirrors the ball, one
step down its ramp, in the lower half, round its middle) is unchanged. It is not weaker: with `PUDDLE_STEP` and `WET_STEP`
swapped in `reflect-effect.ts`, this test and the two WebGL reflection tests fail.
