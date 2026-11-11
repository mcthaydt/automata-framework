# The builders' look and figures in the framework: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task by task,
> in one session per branch, with no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` draws the builders' base scenes with the base pair as the builders do, every taken-over pull request
is merged or closed with its reason, and the prologue's dressing can start.

**Architecture:** Nearly all of the work exists in pull requests (four drafts and #607, which is ready) that were
cut from one commit of `main` and
still merge. The plan brings them in whole, in the order their code depends on each other, each behind a reading of
its diff and the gates, and adds only what nobody wrote: the browser test that would have caught the dark room, a
loud failure for a level that does not read, a measure against the builders' frames, and the ward's clothes.
Bringing a branch in by a merge commit also settles its pull request: GitHub marks it merged when its head is in
`main`.

**Tech stack:** TypeScript, PixiJS with `@pixi/3d` 0.1.0-beta.2, Vitest (unit and browser projects), Playwright,
pnpm and turbo. FigureBuilder as the git submodule `vendor/FigureBuilder`.

**Spec:** [`../specs/2026-11-11-builders-look-and-figures-design.md`](../specs/2026-11-11-builders-look-and-figures-design.md).
**Survey:** [`../audits/2026-11-11-builders-look-survey.md`](../audits/2026-11-11-builders-look-survey.md): read it
first; this plan argues from its measurements. **Tracker:** [`../progress.md`](../progress.md), workstream 4.

## Tracking

**0 of 17 tasks done (0%).** Tick a task only when its checks passed in the session that did it; say what did not run.

| # | Task | Branch | State | Evidence |
|---|---|---|---|---|
| 1 | Bring in glow, windows, openings, baked props and room views (#589) | `claude/builders-look-room` | todo | |
| 2 | The lit room: the browser test, then the fix | `claude/builders-look-room` | todo | |
| 3 | A level that does not read is loud; `world-level-room` draws its room | `claude/builders-look-room` | todo | |
| 4 | `look-pixel-art` draws under the default camera | `claude/builders-look-room` | todo | |
| 5 | Light: the sheets re-shot, the measure, each difference settled; the pull request | `claude/builders-look-room` | todo | |
| 6 | Bring in the lit painted figures (#607, with #603) | `claude/builders-look-figures` | todo | |
| 7 | The painted base pair in the four base scenes; the figures' sheets | `claude/builders-look-figures` | todo | |
| 8 | Exposure: measured against the builder's window | `claude/builders-look-figures` | todo | |
| 9 | Exposure: the builder's rule, only if task 8 says so; the pull request | `claude/builders-look-figures` | todo | |
| 10 | Bring in the effects (#590, with #588) | `claude/builders-look-effects` | todo | |
| 11 | The room-visibility extension leaves | `claude/builders-look-effects` | todo | |
| 12 | Every pass behind its switch; the effects' sheets; the pull request | `claude/builders-look-effects` | todo | |
| 13 | FigureBuilder: drawn moods, the wardrobe golden, the merge | FigureBuilder `claude/c9-wardrobe` | todo | |
| 14 | The kit on FigureBuilder's `main`; the door | `claude/builders-look-wardrobe` | todo | |
| 15 | The ward's clothes as kit entries; moods reach the painter | `claude/builders-look-wardrobe` | todo | |
| 16 | The ward gate sheet; the pull request | `claude/builders-look-wardrobe` | todo | |
| 17 | The record: the survey's table re-measured, the pull requests settled, the builders' fate asked | `claude/builders-look-record` | todo | |

## Branches and merge order

| Order | Branch | From | Holds | Merges |
|---|---|---|---|---|
| 1 | `claude/builders-look-room` | `main` | Tasks 1 to 5 | To `main` first. It repairs what `main` draws, so nothing waits behind it |
| 2 | `claude/builders-look-figures` | `main`, after 1 has merged | Tasks 6 to 9 | Second |
| 3 | `claude/builders-look-effects` | `main`, after 2 has merged | Tasks 10 to 12 | Third |
| 4 | FigureBuilder `claude/c9-wardrobe`, then `claude/builders-look-wardrobe` | their `main`s, after 2 | Tasks 13 to 16 | May run beside 3: it touches the character kit and the submodule only |
| 5 | `claude/builders-look-record` | `main`, after all | Task 17 | Last |

Against workstream 2's branches ([its plan](2026-11-11-last-light-prologue.md)):

- `claude/last-light-framework` (its framework additions) and `claude/builders-look-room` both change
  `packages/3d`. The files both touch (plan audit, finding 16) are `src/features/world/build.ts` (#589 and this plan's
  task 3; its task 9b "only if rooms are not yet separate meshes") and `src/entries/index.ts` (#589, then #590 in
  group 3; 9b exports `drawnRooms`); and 9b's optional `rooms` on a camera view is the field #589's per-room views in
  `features/world/base/base-scenes.ts` would carry. `app/world-view.ts` is this plan's alone. None of these is a
  conflict yet: neither workstream 2 branch exists at `main` `b80bfc84`.
  **`claude/builders-look-room` merges first**; `claude/last-light-framework` then merges `main` in before its own
  pull request. If it has already merged when task 1 starts, task 1 merges `main` as it is and the order is moot.
- Workstream 1's `claude/shared-polish-build` (at `29ccea7f`, being built) merges with all of this plan's drafts in the
  order of this plan with no textual conflict (`git merge-tree`, plan audit); the two files both change are
  `pnpm-lock.yaml` and the generated `agents/automata/skills/automata-api/reference/api.md`. Whichever lands second
  runs `pnpm install` and `pnpm api-index --write` after merging `main` and commits what they change.
- `claude/builders-look-figures` must be on `main` before `claude/last-light-prologue` reaches its dressing task
  ("Dress it: props, lamps, Ada and the figure, poses"). The prologue's earlier tasks do not wait.
- `claude/builders-look-wardrobe` should be on `main` before that dressing task ends: the game composes Ada and the
  night figure from the kit's entries. If it is late, the dressing task starts with the runway wardrobe on `main`
  and takes the ward entries when they land.
- `claude/builders-look-effects` blocks nothing in the prologue; it lands when it is green.

## Where each addition lives

The Owner's rule: core only if any 3D game could use it; an extension if generic within a genre or a library of
ready-made things; otherwise the game. As corrected on `main` (`909f6b10`): core imports no extension, and for the
browser package the framework's own test still applies (every target needs it, or both reference games do).
`@automata/3d` is the 3D core: what follows puts there only what the trim already lists as core, and nothing
in it imports an extension. The 2026-11-07 trim
([`../../refactor/2026-11-07-3d-scope-trim.md`](../../refactor/2026-11-07-3d-scope-trim.md)) rules most of the look.

| Addition | Home | Why |
|---|---|---|
| The baked room shows colour × light (task 2) | Core, `packages/3d` | A fault in core's own bake |
| An empty level is a problem `buildWorld` reports (task 3) | Core, `packages/3d` | Any game that reads a level |
| Glowing swatches at their own step; a lit window; light through a wall's openings; static props baked (task 1) | Core | Light and emissive are the room's own drawing; the trim keeps ramp light and the level's light in core |
| Bloom's rings round what glows (task 1) | World kit | The trim: bloom is the world kit's |
| The colour-only present pass (tasks 1, 6) | Core | It repairs core's own pass chain on both backends |
| A room view per base room at its distance (task 1) | Core, the base scenes' data | The base scenes are core's |
| Painted figures lit by their room, depth per texel on WebGPU (task 6) | Character kit | ADR 0007 as amended: painted figures are the kit's; core gains nothing |
| Exposure, if built (task 9) | Character kit | It is a rule about painted figures |
| The outline's colour rule, the mood grade (task 10) | Core | The trim: the outline is core; the grade is the look's own pass before the snap |
| Shafts, wet-ground reflections, particles (task 10) | World kit | Ready-made passes, each with its switch, beside stars and rain |
| A look pass may run before the snap (task 10) | Core, `packages/3d` | A seam any game's pass could use; the mood grade needs it |
| The letterbox's opt-in whole-pixel scale (task 10) | `@automata/framework`, with its changeset: **kept** (the plan audit's ruling) | The only piece here that touches the browser package. It passes the Owner's rule (generic for any game, of any genre) and core imports no extension for it (`retro-crisp` imports core). On the framework's own test it rests on one reference game: The Last Light's renderer scales in whole pixels (`src/render/crisp.ts` at `92e6704`, which `retro-crisp` ports as `CRISP_CLINIC`), and core's own comments promise whole-pixel upscaling to every pixel-art game (`create-renderer.ts`'s `look`, `composite-target.ts`), which the default `fit` does not give; Emberwick does not ask for it. Opt-in, so no game that does not ask sees a frame change. The ruling is the plan audit's and goes to the coordinator for the Owner (finding 12): reverting it is not the two commits alone (`3565abc8f`, `bdf4b6d0e`, and the docs of `1e01ca1e`) and conflicts in `examples/3d/retrocrisp/retrocrisp-grade.ts` and `spikes/tll-extensions/shoot.mjs` |
| `lcd-panel`, `retro-crisp` (task 10) | Their own extensions | Ready-made looks, ported from The Last Light's own renderer (`src/render/lcd-panel.ts`, `retro-filter.ts`, `crisp.ts`; `docs/refactor/tll-extensions/README.md` on the branch) for its clinic. Any pixel-art game could use either, so they are not the game's code; core imports neither (no `@automata/lcd-panel` or `@automata/retro-crisp` import under `packages/` on the branch). Whether the prologue wears them is workstream 2's to plan, and its plan does not say (finding 11) |
| `room-visibility` (task 11) | Not landed | The Owner's decisions list #588's clinic work as superseded by workstream 2, and workstream 2's task 9b builds the rooms a view draws in core, the form its spec names ("a view that names the rooms it draws"). Two answers to one question is the tangle the Owner's rule exists to stop. What the extension does beyond 9b is handed to workstream 2 by task 11 (finding 10) |
| Hosiery, boots, a cap, a tabard, front hair and a bob, moods (tasks 13 to 15) | FigureBuilder for the generic machinery; the character kit for the garment kinds and outfits | The trim: clothes and hairstyles are the kit's |
| Ada and the night figure themselves | The game, `games/the-last-light` | A kit entry names no character of the game: the kit ships a ward uniform and street clothes, the game says who wears them |

## Global constraints

From the spec, the tracker's decisions and `AGENTS.md`. Every task includes them.

- No subagents. One session per branch. Report to the coordinator after each task's commit.
- Tests first, in `tests/`, importing the code as `#src/…`. Injected clocks, fixed seeds, readiness and never a sleep.
- **Never accept a hash or golden change that this plan does not name.** The plan names exactly one inherited
  change (task 6, the runway cells, ruled on before this workstream) and one new golden (task 16, new cells, which
  is a recording and not a change). Anything else that moves is a stop.
- No tolerance, filter or post pass to hide a mismatch. If a measure misses, stop and report the numbers.
- Nothing is merged unread: each "bring in" task reads the branch's diff against `main` before the merge commit.
- Look at the real expected, actual and difference pictures before accepting a visual change, and write what each
  shows.
- The FigureBuilder submodule is empty in a fresh clone: attach `mcthaydt/FigureBuilder` read-only, run
  `git submodule update --init vendor/FigureBuilder`, and commit nothing from inside it. A task that moves the pin
  commits the pin only.
- EnvironmentBuilder is needed by two steps only, task 5's street diagnosis (its `paint/vertex-light.ts`, `look.json`
  and `times.json`) and task 9 (its `view/expose.ts`): attach `mcthaydt/EnvironmentBuilder` read only, check out
  `f7c5356` (the commit whose frames are in `builders/`), and commit nothing from it (plan audit, finding 17). Every
  other step works from the frames committed here.
- Chromium only, on software WebGL. The shoot script launches it with `--use-angle=swiftshader
  --enable-unsafe-swiftshader`; the vitest browser projects pass no flags and Chromium's headless default is the same
  software path here (the plan audit ran task 2's test that way). WebGPU on a real GPU, WebKit and Firefox are reported
  as not run.
- A source file has at most 600 lines; comments say why, never which plan asked.
- `pnpm format` before each commit; Conventional Commits; only published packages get a changeset, and it is
  `patch`.

### The gates

`pnpm check`, whole, exit 0. It stops at its first failing step, so when it fails, run the steps after it one by
one (`pnpm lint`, `typecheck`, `boundaries`, `style`, `source-names`, `knip`,
`pnpm exec turbo run test:unit --continue -- --testTimeout=90000`, `check:changesets`) and report each: a later step
may be hiding a second failure. (During the survey `main` at `6a70f9b1` failed `style` and `source-names` on
documents; `main` at `f93a2402` repaired that, and both steps were re-run there with these documents in: 0
findings.) The unit tests take about 9 minutes alone on the planning machine and 15 with other work running.

"The 3D browser suites" means, in Chromium:

```sh
pnpm --filter @automata/3d test:browser
pnpm --filter @automata/world-kit test:browser
pnpm --filter @automata/character-kit test:browser
pnpm --filter @af-examples/examples-3d test:e2e -- --trace off
```

### The measures

The spec leaves the measure for "as the builders do" to this plan. One per part:

| Part | Measure | Passes when |
|---|---|---|
| Light | For each of the 8 scene sheets, the baked panel's mean brightness over the builder's, from `shots.json` | Each ratio is between 0.80 and 1.20, and the pictures have been looked at |
| The baked surface | The browser test of task 2: a known colour under a known light | The pixel is the product, within 4 of 255 |
| Albedo and tiles | EnvironmentBuilder's own harness measured this by palette index; it is on `main` and is not re-measured | Not regressed: the material panels' colour counts in `shots.json` do not fall |
| Figures | The kit's `painted-lit` browser test: a lit frame against the builder's `compose` | 0 pixels differ |
| A figure in its room | World kit's `figureReads` on the frame: the figure's luma over its ring's, and its edge | Not hot (at most 1.1 × its ring) and reading (edge at least 1.1), the builder's own window |
| Glow and effects | Each pass's browser test on the branch, and the day base sheets unchanged with every effect's switch off | The day sheets' numbers move by at most 2.0 in brightness |

### The sheets

`spikes/builders-look/shoot.mjs` shoots every sheet and writes `shots.json` (it lived in the survey's folder until the
plan audit moved it, finding 2: `knip` failed `main` on it as an unused file, and it ignores `spikes/**`). The builders'
own frames are committed in the survey's `builders-look-survey/builders/`, so no task needs the builders' repositories
to re-shoot:

```sh
ln -sfn ../../examples/3d/node_modules spikes/eb-look/node_modules     # once; git-ignored
pnpm --filter @af-examples/examples-3d build
node spikes/builders-look/shoot.mjs <out dir>                          # default: the survey's own folder
```

Each group writes its sheets to a folder of its own beside the survey's (`after-room/`, `after-figures/`,
`after-effects/`), never over the survey's, so the before and after stay side by side.

## Review focus

What the spec implies and no draft's tests exercise, most likely first. Each has its test in the task named.

1. **A room lit by `worldLighting` that reaches the screen dark.** Unit tests of the bake pass while the screen is
   wrong. Task 2's browser test reads the screen.
2. **A level that fails validation and draws as an empty room with no word.** Task 3.
3. **An example or game written for the old 5 m camera.** Fog, sizes and distances tuned to it now miss. Task 4
   fixes the one that remains and task 5 looks at every 3D example's first frame.
4. **A WebGL warning that is not an error.** The feedback loop on `main` is logged as a warning, so no test that
   collects errors sees it. Task 4's journey collects console warnings too and fails on one that names a feedback loop.
5. **A pass that changes a frame while its switch is off.** Task 12 shoots the day sheets with every new switch off
   and compares the numbers with task 5's.

---

## Group 1: the lit room and its light (`claude/builders-look-room`)

### Task 1: Bring in glow, windows, openings, baked props and room views (#589)

The dark-room fix (task 2) cannot be applied to `main` alone: it was written on top of this branch's
`app/world-view.ts` and `vertex-bake.ts` and conflicts in four files without it. So #589 comes first, although the
spec lists glow later.

**Files:** none written by hand. The merge brings 53 files under `packages/`, `extensions/`, `examples/` and
`games/` (+1687, −314) and their records under `docs/refactor/eb-look/glow/`.

**Interfaces:**
- Consumes: `origin/claude/eb-look-glow` at `0024f81a`.
- Produces: on the branch, the colour-only present pass (`packages/3d/src/features/look/present-pass.ts`), glowing
  swatches, lit windows, `worldOccluders` cut at openings, baked static props, the bloom's rings, and a camera view
  per base room. Task 2 builds on `app/world-view.ts` and `shared/render/light/vertex-bake.ts` as this leaves them.

- [ ] **Step 1: Branch and baseline.** `git fetch origin main claude/eb-look-glow && git checkout -b
  claude/builders-look-room origin/main`; place the submodule; `pnpm install`. Run the gates and write down the
  result: this is the baseline every later task is compared with.
- [ ] **Step 2: Check the head.** `git rev-parse origin/claude/eb-look-glow` is `0024f81a…`. If it has moved, read
  the new commits and tell the coordinator before going on.
- [ ] **Step 3: Read it.** `git log --reverse --no-merges origin/main..origin/claude/eb-look-glow` lists 18
  commits. Read each one's diff. Confirm, and write the answers in the task's report:
  - no file under a `goldens/` or `__goldens__/` folder and no `GOLDEN_HASH` changes
    (`git diff --name-only origin/main...origin/claude/eb-look-glow | grep -i golden` prints nothing);
  - the only test expectation that moves is the default lens (`toBeCloseTo(53.13, 2)` to `26.99`), which follows
    the 50 mm camera already on `main`;
  - the `it.fails` on the WebGPU scene-depth case is replaced by a passing test, not deleted.
- [ ] **Step 4: Merge.** `git merge --no-ff origin/claude/eb-look-glow`, message
  `merge: glow, lit windows, bloom, light through openings, baked props and room views (#589)`. Expected: no
  conflict.
- [ ] **Step 5: Gates and suites.** Run the gates: the same results as step 1's baseline. Run the 3D browser suites
  in Chromium: all pass, the WebGPU cases skip or pass.
- [ ] **Step 6: Look.** Shoot the sheets into `after-room/` (they are overwritten in task 5). Open
  `after-room/base-interior-fp.png`: the pendant's bulb is drawn at its own bright step. The baked room is still
  dark: that is task 2.
- [ ] **Step 7:** The merge commit is the commit. Report to the coordinator.

### Task 2: The lit room: the browser test, then the fix

**Files:**
- Create: `packages/3d/tests/browser/parity/look/lit-room.test.ts`
- Brought in by cherry-pick: `packages/3d/src/app/world-view.ts`,
  `packages/3d/src/shared/render/light/{scene-lighting.schema,vertex-bake}.ts`, their unit tests,
  `spikes/eb-look/{probe.mjs,scene.ts}`

**Interfaces:**
- Consumes: `createPixi3dRenderer`, `worldLighting(world, time)`, `drawWorld`, `buildWorld`, `BASE_SCENES`,
  `baseLibrary`, `swatchColour`, `levelTime`, and the testing helpers `builtRenderer`, `snapshot`, `testTarget`.
  The test goes through `drawWorld` and never makes a baked material by hand: the fix changes which material a
  baked piece takes, and that is `drawWorld`'s business.
- Produces: nothing new in the API. After it, a baked piece's screen colour is its albedo × its light.

- [ ] **Step 1: Write the failing test.**

```ts
// A baked room on a real context: what reaches the screen is the surface's colour times its light, and a level's
// room lit by its own lamps and time is not a dark frame. Headless Firefox here has no WebGL, so these skip there.
import '#src/entries/no-eval.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { createPixi3dRenderer, type Pixi3dRenderer } from '#src/app/create-renderer.ts'
import { worldLighting } from '#src/app/world-lighting.ts'
import { drawWorld } from '#src/app/world-view.ts'
import { baseLibrary } from '#src/features/world/base/base-library.ts'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { swatchColour } from '#src/features/world/swatches.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { levelTime } from '#src/shared/time-of-day/time-light.ts'
import { builtRenderer } from '#src/testing/built-renderer.ts'
import { snapshot } from '#src/testing/snapshot.ts'
import { testTarget } from '#src/testing/test-target.ts'

const hasWebGL2 = document.createElement('canvas').getContext('webgl2') !== null
const WIDTH = 160
const HEIGHT = 100
const frame = { alpha: 1, frameMs: 16, paused: false }

let scope: { dispose(): void } | undefined
afterEach(() => {
  scope?.dispose()
  scope = undefined
  document.body.replaceChildren()
})

async function start(options: Parameters<typeof createPixi3dRenderer>[0]): Promise<Pixi3dRenderer> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const renderer = await builtRenderer(createPixi3dRenderer(options)(testTarget(host)))
  scope = renderer
  return renderer
}

/** The mean of red, green and blue over the whole frame, 0 to 255. */
const brightness = (pixels: ArrayLike<number>): number => {
  let total = 0
  for (let i = 0; i < pixels.length; i += 4) total += ((pixels[i] ?? 0) + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0)) / 3
  return total / (pixels.length / 4)
}

describe.runIf(hasWebGL2)('a baked room on WebGL2', () => {
  it('shows the colour times the light: a mid grey room under half light is a quarter grey', async () => {
    // Ambient alone, no lamp, key, fill or step: every surface's light is exactly 0.5.
    const lighting = sceneLightingSchema.parse({ ambient: 0.5, colorSpace: 'srgb', lamps: [] })
    const world = buildWorld(BASE_SCENES['base-interior'], baseLibrary)
    const renderer = await start({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      lighting,
      scene: (view, _stage, _occluders, light) => {
        view.camera.fov = 64
        view.camera.position.set(0, 1.6, 2.2)
        view.camera.lookAt({ x: 0, y: 1.6, z: -2.5 })
        // Every swatch is the one grey, and no tiles: the frame is one flat colour times one light.
        drawWorld({ parent: view.root, colourOf: () => 0x808080, light }, world.pieces)
        return undefined
      },
    })
    renderer.draw(frame)
    const pixels = snapshot(renderer)
    const centre = (Math.floor(HEIGHT / 2) * WIDTH + Math.floor(WIDTH / 2)) * 4
    const seen = [pixels[centre], pixels[centre + 1], pixels[centre + 2]]
    // 0x80 × 0.5 = 64 in the display's own units. The fault this guards showed that product to the power 2.2: 13.
    for (const channel of seen) expect(Math.abs((channel ?? 0) - 64), `saw ${seen.join(', ')}`).toBeLessThanOrEqual(4)
  })

  it("the base interior, lit by its lamp at its own time, is not a dark frame", async () => {
    const level = BASE_SCENES['base-interior']
    const time = levelTime(level.time)
    const world = buildWorld(level, baseLibrary, { night: time.name !== 'day' })
    const renderer = await start({
      logicalWidth: WIDTH,
      logicalHeight: HEIGHT,
      backgroundColor: 0x000000,
      views: {},
      time,
      lighting: worldLighting(world, time),
      scene: (view, _stage, _occluders, light) => {
        // First person from the door, as the builder frames the room: every pixel is a wall, the floor or the ceiling.
        view.camera.fov = 64
        view.camera.position.set(0, 1.6, 2.2)
        view.camera.lookAt({ x: 0, y: 1.6, z: -2.5 })
        drawWorld({ parent: view.root, colourOf: (swatch) => swatchColour(baseLibrary, swatch), light }, world.pieces)
        return undefined
      },
    })
    renderer.draw(frame)
    // The builder's own first-person frame of this room reads 47.8; the fault this guards read under 23.
    expect(brightness(snapshot(renderer))).toBeGreaterThan(32)
  })
})
```

  This file was run in the planning session, and again by the plan audit (finding 1, which also made it typecheck:
  `Pixi3dRenderer.draw` takes the frame alone): it fails on `main` (`saw 13, 13, 13`; brightness 6.2) and on `main` +
  #589 (13; 6.9), and passes on `main` + #589 + the fix (64, 64, 64; 42.1). `tsc -p packages/3d` and `biome lint` are
  clean on it.

- [ ] **Step 2: Run it and see it fail for the right reason.**
  `pnpm --filter @automata/3d exec vitest run --project browser --browser=chromium tests/browser/parity/look/lit-room.test.ts`
  (`--browser=chromium` because Firefox is not installed here). Expected: both cases FAIL, as they do on `main`:
  `saw 13, 13, 13` in the first (the product to the power 2.2) and a brightness near 6 in the second.
- [ ] **Step 3: Bring in the fix.** `git cherry-pick -x 680bbc31a` (from `origin/claude/eb-look-effects`: "a baked
  room shows albedo × light, not its 2.2 power"). Expected: no conflict. Read its diff and
  `docs/refactor/eb-look/dark-interior.md` on that branch (`git show origin/claude/eb-look-effects:docs/refactor/eb-look/dark-interior.md`).
- [ ] **Step 4: Run the test and see it pass.** The same command. Expected: 2 passed. Then the package's unit
  tests: `pnpm --filter @automata/3d test:unit`, all pass.
- [ ] **Step 5: Gates.** As the baseline. `pnpm format`.
- [ ] **Step 6: Commit** the test: `test(3d): a baked room reaches the screen as colour times light, in a browser`.
  (The cherry-pick is its own commit.)

### Task 3: A level that does not read is loud; `world-level-room` draws its room

The survey's cause: the example's level lacks `floor` and `light`, `readLevel` returns an empty level with two
problems, the example reads only `.level`, and `buildWorld` returns nothing and says nothing.

**Files:**
- Modify: `packages/3d/src/features/world/build.ts`, `packages/3d/tests/unit/world/build.test.ts`
- Modify: `examples/3d/world/world-level-room.ts`, `examples/3d/tests/e2e/world-level-room.test.ts`

**Interfaces:**
- Produces: `buildWorld(level, library)` on a level with no sectors returns `pieces: []` and one problem:
  `{ path: ['sectors'], code: 'empty-level', message: 'This level has no rooms, so nothing is drawn. If it was read from a file, look at the problems readLevel returned.', where: 'sectors' }`
  (`where` is "the JSON path of the member when it is in none", `LevelProblem`'s own rule; plan audit, finding 21).

- [ ] **Step 1: The failing unit test,** in `build.test.ts`:

```ts
it('says so when the level has no rooms, in place of drawing nothing in silence', () => {
  const empty = { ...BASE_SCENES['base-interior'], sectors: [] }
  const world = buildWorld(empty, baseLibrary)
  expect(world.pieces).toEqual([])
  expect(world.problems.map((p) => p.code)).toEqual(['empty-level'])
})
```

  (Import `BASE_SCENES` and `baseLibrary` as the file's other tests reach their fixtures, by `#src/…`.)
- [ ] **Step 2: Run it:** `pnpm --filter @automata/3d exec vitest run --project unit tests/unit/world/build.test.ts`.
  Expected: FAIL, `problems` is `[]`.
- [ ] **Step 3: Implement** in `buildWorld`, before the shell loop: when `level.sectors.length === 0`, push that
  problem.
- [ ] **Step 4: Run it:** PASS.
- [ ] **Step 5: The failing journey.** In `world-level-room.test.ts`, after the existing colour check, add:

```ts
// The room itself, not only Wick: a lit floor and walls lift the frame well clear of a black one (4.6 when the
// level failed to read and only the figure drew).
expect((await seen(frame)).brightness).toBeGreaterThan(20)
```

  Run `pnpm --filter @af-examples/examples-3d test:e2e -- --trace off world-level-room`. Expected: FAIL, about 4.6.
- [ ] **Step 6: Repair the example.** In the sector, add `floor: 0` and `light: 1`. Replace
  `buildWorld(readLevel(room).level, world).pieces` with a read that cannot be dropped:

```ts
const read = readLevel(room)
if (read.problems.length > 0) throw new Error(`the room did not read: ${read.problems.map((p) => p.message).join('; ')}`)
```

  and build from `read.level`. **The file is at its line budget already** (plan audit, finding 5): 100 code lines,
  and the examples' budget is 100 (`CODE_LINE_BUDGET`, `tooling/examples-runner/src/catalog.ts`), which
  `tooling/examples-runner/tests/unit/catalog.test.ts` ("the real 3d examples pass the catalog") holds in `pnpm check`.
  The repair adds at least four, so it gives back as many in the same file without changing what it shows (the read
  and the throw each on one line, the two sector fields on one line), and the catalog test is run before the commit.
- [ ] **Step 7: Run the journey:** PASS. Open a screenshot of the example and look: a floor and walls in the
  `dusk` ramp, Wick in the middle. If the brightness is under 20 with the room drawn, the swatches are simply dark:
  report the number and lower nothing; ask.
- [ ] **Step 8: The API report.** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`; commit what
  they write (expected: nothing, the problem's `code` is a `string`).
- [ ] **Step 9: Gates, format, commit:** `fix(3d): an empty level is a problem, and the level room example reads its level`.

### Task 4: `look-pixel-art` draws under the default camera

The survey's cause: fog from 5 to 14 m under a camera now 16 m away.

**Files:**
- Modify: `examples/3d/look/look-pixel-art.ts`, `examples/3d/tests/e2e/look-pixel-art.test.ts`

- [ ] **Step 1: The failing journey.** In `look-pixel-art.test.ts` add two checks. First, in the file's own style
  of reading the canvas, that the frame's mean brightness is over 40 (measured: 19.7 to 32.3 as it is, 48.5
  repaired). Second, that no console message of type `warning` or `error` contains `Feedback loop`
  (`page.on('console', …)` from before the page loads). Run it: the first FAILS; the second passes on this branch
  (the present pass came with task 1) and fails on `main`. If the second fails here, stop and report: the present
  pass is not doing its job.
- [ ] **Step 2: Repair.** `fog: { near: 16, far: 30, color: 0x31222a }`, with a comment that the fog starts at the
  camera's distance so the figure stands clear of it. Change nothing else.
- [ ] **Step 3: Run:** PASS. Look at the frame: the floor in its own colour, Wick readable, the fog taking the
  floor's far edge.
- [ ] **Step 4: Gates, format, commit:** `fix(examples): the pixel-art example's fog starts at the default camera's distance`.

### Task 5: Light: the sheets re-shot, the measure, each difference settled; the pull request

**Files:**
- Create: `docs/superpowers/audits/builders-look-survey/after-room/` (sheets, `shots.json`, `README.md`)
- Modify: `docs/superpowers/progress.md`, this plan's tracking table and log

- [ ] **Step 1: Shoot** into `after-room/`.
- [ ] **Step 2: The measure.** From `after-room/shots.json`, the baked panel's brightness over the builder's, for
  the 8 scene sheets. Expected, from a trial of this state in the planning session (`main` + #589 + the fix; mesh
  figures): the four interior sheets between 0.85 and 1.01 (diorama 44.3 against 50.8, first person 48.5 against
  47.8, dressed 43.1 against 50.7 and 47.3 against 48.2), and the street's diorama 0.73 (90.0 against 123.2; it is
  0.29 on `main`). The band that passes is **0.80 to 1.20**. The interiors are expected inside it. The street is
  expected to miss, and step 3 says what to do about it. An interior sheet outside the band is a stop: report the
  numbers; do not tune a light to reach it.
- [ ] **Step 3: Look at all 12 sheets** beside the survey's and write `after-room/README.md`: for each of the
  survey's eleven named differences, one line: fixed (with the picture that shows it), still there and why, or
  accepted and by whom. In particular:
  - **the street, still about a quarter darker than the builder's: a diagnosis, with stops** (plan audit, finding 4).
    The method is #590's `docs/refactor/eb-look/dark-interior.md`: measure each stage on both sides until one stage
    differs, then fix that stage with its failing test. What is already known: AF's bake and EnvironmentBuilder's
    `paint/vertex-light.ts` are the same formula term for term (ambient plus the key on the normal, the fill faded by
    height, the sun × N·L × its shadow share, the lamps × 2.6, capped at 1.6, stepped by 0.1; the sun's direction is
    the time's key turned out of the camera's pitch in both, and AF's `LIGHT_PROFILE` holds EnvironmentBuilder's
    `look.json` numbers), so the profile is the least likely place. EnvironmentBuilder's `docs/lighting.md` gives the
    formula, not numbers: the numbers come from its code, so attach `mcthaydt/EnvironmentBuilder` read only at
    `f7c5356` (as this plan's global constraints now say) and commit nothing from it.
    1. **Take the figures out first:** shoot the street's sheets with `&cast=0` and write both ratios down.
    2. **The bake against the builder's, per vertex** (Node): `bakeVertices` over the base exterior's pavement, road
       and a sunlit wall under `worldLighting(world, time)` at `day`, beside EnvironmentBuilder's `vertexLight` on the
       same points (a probe script in the scratch folder, as `spikes/eb-look/probe.mjs` was). Equal within one step
       (0.1): go to 3. Lower: the failing unit test in `packages/3d/tests/unit/app/world-lighting.test.ts` states the
       builder's number for that vertex, then the fix in `worldLighting` or `LIGHT_PROFILE`. Higher: stop and report.
    3. **The screen against the bake:** the probe's method of forcing a piece's vertex colour, on the street's pavement
       (the tile under light 1, then under the measured light). The screen is the product: go to 4. It is not: add the
       case to `lit-room.test.ts` (the base exterior by day, first person from the kerb, brightness over 0.8 × the
       builder's), see it fail, fix, see it pass.
    4. **The composition:** if every stage agrees and the frame is still darker, the difference is in what the frame
       holds (the haze over the street, the sky's share, the diorama's cut). Name it in the README with the pictures
       and stop there: that is a framing question for the coordinator, not a fault to fix.
    **Stops:** two hours on this bullet without a stage found; a fix that moves an interior sheet out of the band; any
    existing test expectation in `packages/3d` that moves (each must be named in the commit with why, or it is a stop);
    and no constant is changed to reach a ratio, only to match the builder's term. At a stop, report the stage numbers
    to the coordinator; the group's draft pull request still opens (step 7) with the street's row open and the numbers
    in it, and it merges only on the coordinator's word.
  - difference 5, the pendant's pool: it should now read on the floor;
  - difference 4, the day panes: look for the builder's reflection streaks. #589 draws a lit window's room at
    night; if the day streaks are absent, say so and leave it named;
  - difference 10, the green veil outside the room: shoot `base-interior` gameplay with `&look=0` (the spike's
    switch) to see whether it is the haze; write what it is. If it is the haze drawn over the letterbox's field
    where no mesh is, it is a fault of where the haze reads depth and gets its own failing browser test and fix
    here; if it is the sky's lowest band, it is right;
  - difference 6, a figure's cast shadow: not built. The coordinator's call is to accept it as a named difference
    until the Owner says otherwise.
- [ ] **Step 4: Every 3D example's first frame.** With the examples built, open each example's page and take one
  picture (the survey's scratch method: a static server over `examples/3d/dist`, Play, 40 frames). List any that
  draws under a brightness of 20 or logs a console warning, with its cause if it takes under ten minutes to find.
  Fix none here that is not one line; report the rest. They are cut with Ember Hall soon.
- [ ] **Step 5: The gates and the 3D browser suites,** whole.
- [ ] **Step 6: Record.** Tick tasks 1 to 5; write the log line; update `progress.md`.
- [ ] **Step 7: Commit** `docs(superpowers): the lit room healthy: sheets, the measure and what still differs`, push,
  and open a **draft** pull request to `main` titled `feat(3d): the lit room is healthy: the baked light reaches the
  screen, with glow, windows and light through openings (#589)`. Its description lists what ran and what did not.
  When it merges, #589 shows as merged; write on #589, in one comment, that it landed whole through this branch.
  Four more show as merged with it, because each one's head is in #589's branch (the plan audit checked each by
  ancestry, finding 14): #587 (`claude/fix-3d-browser-ci`), #601 (`claude/fix-ci-submodule-checkout`), #602
  (`claude/fix-scene-depth-hazard`) and #604 (`claude/fix-e2e-ports`). Check that they do and write the same one line
  on each; if one does not, close it with the reason.

---

## Group 2: figures lit as sprites (`claude/builders-look-figures`)

### Task 6: Bring in the lit painted figures (#607, with #603)

**Files:** none by hand. The merge brings the kit's `features/painted/{room-light,lit-cells}.ts` and changes to
`painted-stage.ts`, `painted-view.ts`, `painter.ts`, the door, the kit's tests and bench, the pin of
`vendor/FigureBuilder` (`d6e3c9f` to `23f889c`), and the c8 records under `docs/refactor/`.

**Interfaces:**
- Consumes: `origin/claude/c8-lit` at `7167af1f`.
- Produces: `paintedFigure(def, { lit?: boolean })`: lit by default when the renderer has `lighting`; `lit: false`
  keeps the painter's cell. Depth per texel on WebGPU.

- [ ] **Step 1: Branch** from `main` after group 1 has merged. Place the submodule, `pnpm install`, the gates as a
  baseline.
- [ ] **Step 2: Read it.** 22 commits (`git log --reverse --no-merges origin/main..origin/claude/c8-lit`; those
  already on `main` through group 1 drop out). Read each diff, and the two audits on the branch
  (`docs/refactor/2026-11-11-c8-lit-plan-audit.md`, `…-implementation-audit.md`).
- [ ] **Step 3: The one golden that moves.** `git diff --name-only origin/main...origin/claude/c8-lit | grep -i golden`
  prints `runway-cells.json`, `runway-golden.ts` and `runway-golden.test.ts` and nothing else. Confirm that
  `git log --oneline origin/main..origin/claude/c8-lit -- extensions/character-kit/tests/fixtures/goldens/runway-cells.json`
  prints exactly one commit, `ea71e0a30`, whose message says why (FigureBuilder's hair-pole rule: 42 of 112 cells,
  281 texels, all hair), and that `ARCH_OVERRIDES` is gone from `runway-golden.ts` (one comment in `ulp.test.ts`
  still names it, as history). The commit's title says "FigureBuilder at d5ca055": the pin moved twice more on the
  branch, to `7797d4a` and then to `23f889c` (FigureBuilder `main`'s merge of #28), and the commits between change
  `lightSprite`'s speed only, so the golden holds at the branch's pin. This change was ruled on by the coordinator of
  that cycle: the ruling ("hair or an ear moved by the pole rule is accepted") is quoted in
  `docs/refactor/c8/runway-hair-poles/README.md` on the branch, with the 42 cells' pictures, and recorded in rows 9
  and 10 of the branch's `docs/refactor/progress.md`. The plan audit checked all of it on `7167af1f` (finding 22).
  If any other commit touches a golden, stop.
- [ ] **Step 4: Merge.** `git merge --no-ff origin/claude/c8-lit`, message
  `merge: painted figures lit by their room, depth per texel on WebGPU, an arch-stable painter (#607, #603)`.
  Then `git submodule update --init vendor/FigureBuilder` so the checkout is at the new pin `23f889c`.
- [ ] **Step 5: Gates and suites.** The gates as the baseline. The kit's suites:
  `pnpm --filter @automata/character-kit test:unit` and `test:browser` (Chromium: the `painted-lit` cases report 0
  pixels against `compose`). The kit's bench is recorded, not asserted beyond its medians; write its three medians
  in the report.
- [ ] **Step 6:** Report to the coordinator.

### Task 7: The painted base pair in the four base scenes; the figures' sheets

The survey's sheets draw a level's cast as core meshes. This makes the comparison the spec asks for: the builders'
figures in the builders' rooms against the kit's figures in the framework's rooms.

**Files:**
- Modify: `spikes/eb-look/scene.ts` (a switch `?figures=painted`), `spikes/builders-look/shoot.mjs`
  (a third argument: query text added to every scene URL, such as `figures=painted` or `fx=0`)
- Create: `docs/superpowers/audits/builders-look-survey/after-figures/`

**Interfaces:**
- Consumes: `paintedFigure`, `BASE`, `characterKitExtension` from `@automata/character-kit`.
- Produces: with `?figures=painted` the spike's cast view is `paintedFigure(BASE[i].def)` for the man (`i` 0) and
  the woman (`i` 1), placed and turned as the mesh cast is; the extension joins the game's `extensions`.

- [ ] **Step 1:** Add the switch. A spike is exempt from tests-first; nothing in a package changes.
- [ ] **Step 2: Shoot** into `after-figures/` with `figures=painted` as the third argument (the second, the
  builders' frames folder, stays `docs/superpowers/audits/builders-look-survey/builders`).
- [ ] **Step 3: Look at all 12 sheets** and write `after-figures/README.md`: for each scene, how the pair reads
  beside the builder's pair: the flat light's warmth under the pendant, the one-step form, the rim on the lamp's
  side, and that a wall or a chair hides the texels behind it. Name each difference.
- [ ] **Step 4: Gates** (biome and knip ignore `spikes/`, where both the page and the shoot script are). Commit
  `docs(superpowers): the painted base pair in the base scenes, beside the builders' frames`.

### Task 8: Exposure: measured against the builder's window

The builder scales each figure's flat light down in whole steps until the figure is not hot against its ring, by a
trial composite on the CPU. #607 instead holds a figure at or under its painted cell. Before porting the trial,
measure whether the hold already meets the builder's window.

**Files:**
- Modify: `spikes/builders-look/shoot.mjs`
- Create: `docs/superpowers/audits/builders-look-survey/after-figures/reads.json`

**Interfaces:**
- Consumes: `figureReads(frame: Frame, ring = 3): FigureRead[]`, `isHot`, `MIN_READ` (1.1), `HOT` (1.1) from
  `@automata/world-kit`. A `Frame` needs two depth buffers that differ where a figure is.
- Produces: in `shoot.mjs`, for each baked scene panel shot with painted figures, a second shot with `&cast=0`;
  a figure's texels are the pixels that differ between the two. `reads.json` holds, per scene and view and figure:
  `figure`, `around`, `luma`, `edge`, `read`, `hot` (figure > 1.1 × around) and `reads` (edge ≥ 1.1). `reads` is the
  builder's exposure window, which tests the edge alone (`minEdge`), not `figureReads`' own rule (the stronger of luma
  and edge, its `read`), so both are kept (finding 20). The read is computed
  in the page from the two PNGs with a small copy of the luma and ring arithmetic, or by importing the kit's
  function through the spike's vite server; either way the numbers are `figureReads`' definitions.

- [ ] **Step 1:** Write it; shoot; commit `reads.json` with the sheets.
- [ ] **Step 2: Decide by the numbers.** If no figure in the 8 scene sheets is hot and every one reads: exposure as
  a trial is not needed for the base scenes. Write that in the README with the table, mark task 9 "not needed:
  measured", and ask the coordinator for the Owner's word that the hold rule stands in for the builder's exposure.
  If any figure is hot or fails to read: task 9 runs.
- [ ] **Step 3: Commit** `docs(superpowers): how the lit figures read against their rooms`.

### Task 9: Exposure: the builder's rule, only if task 8 says so; the pull request

**Files (only if it runs):**
- Create: `extensions/character-kit/src/features/painted/exposure.ts`,
  `extensions/character-kit/tests/unit/painted/exposure.test.ts`
- Modify: `extensions/character-kit/src/features/painted/room-light.ts`

**Interfaces:**
- Produces: `exposureSteps(readAt: (steps: number) => { figure: number; around: number; edge: number } | undefined, top: number, o: { hot: number; minEdge: number }): number`,
  the builder's function of the same name (`src/features/view/expose.ts` in EnvironmentBuilder, 68 lines; read it
  there and port its rule and its tests, not its buffers): the largest whole step `n ≤ top` whose trial is not hot,
  raised to the first step whose edge is at least `minEdge` when the edge at `top` was; a figure with no read, or
  lit under two steps, keeps `top`.
- The trial's read comes from the lit cell composited on the CPU over the room's colour behind the cell's box,
  read back once when a figure's light key changes (the cache `lit-cells.ts` already keys on), never per frame.

- [ ] **Step 1: The failing unit tests:** the five cases of the builder's rule above, each as one `it` with a
  hand-written `readAt` table (hot at `top` and not at `top − 1` gives `top − 1`; never hot gives `top`; the edge
  clamp raises `n`; no read keeps `top`; `top < 2` keeps `top`).
- [ ] **Step 2:** Run: FAIL (no module). **Step 3:** Implement. **Step 4:** Run: PASS.
- [ ] **Step 5:** Wire it in `room-light.ts` behind the figure's `lit` option, re-shoot `after-figures/`, re-run
  task 8's read: no figure hot. The `painted-lit` parity test still reports 0 pixels with exposure off; with it on,
  the kit's own trial is the reference, so add the case to the kit's browser test rather than loosening parity.
- [ ] **Step 6: Gates, the kit's suites, format, commit:** `feat(character-kit): a lit figure is exposed toward its ring`.

Whether or not task 9 ran:

- [ ] **The pull request.** Tick the group's tasks, write the log, update `progress.md`, push, open a **draft** pull
  request to `main`: `feat(character-kit): painted figures lit by their room (#607, #603)`. When it merges, #607 and
  #603 show as merged; one comment on each says it landed through this branch.
- [ ] **The word workstream 2 waits for** (finding 15). Its task 13 starts "when workstream 4 says the prologue's
  dressing can start". When groups 1 and 2 are both on `main`, send the coordinator that word, in one message: the lit
  room and the lit painted figures are on `main` (their merge commits), the street's row as it stands, and that the
  ward's outfits follow from group 4 (the dressing may start with the runway wardrobe and take them when they land).

---

## Group 3: glow's remaining passes and the effects (`claude/builders-look-effects`)

### Task 10: Bring in the effects (#590, with #588)

**Files:** none by hand. The merge brings core's coloured outline and mood grade, the world kit's shafts,
reflections and particles, a look pass before the snap, the letterbox's whole-pixel scale (a published package,
with its changeset), and the three extensions of #588 with their examples and journeys.

**Interfaces:**
- Consumes: `origin/claude/eb-look-effects` at `22b63b54`.

- [ ] **Step 1: Branch** from `main` after group 2 has merged; submodule; install; baseline.
- [ ] **Step 2: Read it.** `git log --reverse --no-merges origin/main..origin/claude/eb-look-effects`. No golden
  moves (`… | grep -i golden` prints nothing). The new `toBeCloseTo` lines are new tests, not loosened ones.
- [ ] **Step 3: Merge.** `git merge --no-ff origin/claude/eb-look-effects`, message
  `merge: the look's effects and the render extensions (#590, #588)`. Expected: `spikes/eb-look/probe.mjs` conflicts
  (added by task 2's cherry-pick and changed later on the branch): take the branch's,
  `git checkout --theirs spikes/eb-look/probe.mjs && git add spikes/eb-look/probe.mjs`. The plan audit made this merge
  on `main` + #589 + the fix + #607 and saw that conflict alone. Expect a second, in `spikes/eb-look/scene.ts`: task 7
  adds `?figures=painted` there, and the branch changes the same file beyond #589 (`glow`, `bloom`, `fx`, `outline`,
  `snap`, `haze`, `grade`, `wet`). Keep both: every switch of the branch's and task 7's `figures` switch, then load the
  page with `?figures=painted&fx=0` before going on (finding 6). Any other conflict: stop
  and report.
- [ ] **Step 4: Gates and suites.** As the baseline, plus `pnpm build`, `pnpm api-report` and `pnpm api-index`
  with no difference (a published package's exports changed on the branch and its reports came with it).
- [ ] **Step 5:** Report to the coordinator.

### Task 11: The room-visibility extension leaves

Ruled by the Owner's decisions (#588's clinic work is superseded by workstream 2) and checked by the plan audit:
workstream 2's task 9b builds "the rooms a view draws" in core; two answers to one question do not both land.
`lcd-panel` and `retro-crisp` stay.

**Files:**
- Delete: `extensions/room-visibility/`, `examples/3d/roomvisibility/`, its journey under `examples/3d/tests/e2e/`
- Modify: every file `git grep -l "room-visibility\|roomvisibility\|RoomVisibility"` lists outside `docs/`: on the
  branch that is the examples' `package.json` and README, the root `package.json`,
  `tooling/examples-runner/src/catalog.ts`, `spikes/tll-extensions/shoot.mjs` and the lockfile (through
  `pnpm install`). Under `docs/`, change only `docs/refactor/tll-extensions/README.md` (step 1) and
  `docs/provenance/sources.md`'s row for the old game's room-visibility files, which names `extensions/room-visibility`
  as their target (the `sources-md --complete` half of `pnpm source-names` reads it); `docs/archive/` is history and its mentions are of the
  old game's policy, and `docs/refactor/progress.md`'s rows are the record (finding 10)

- [ ] **Step 1:** Delete and unwire. Leave the notes under `docs/refactor/tll-extensions/` as the record; there is
  no separate note for this extension, so add one line under the README's title: `room-visibility` was not landed,
  and why.
- [ ] **Step 1b: Hand over what 9b does not cover.** The extension (and the old game's `src/render/room-visibility.ts`)
  does more than name a view's rooms: it always draws the room the player stands in, holds the zone just left for
  0.35 s under the camera's blend (not under reduced motion), draws a peek's far side (`also`), draws every room in a
  cutscene, and hides a wall's cutaway group from named zones (`hideFrom`). Workstream 2's survey drops `hideFrom`
  on purpose (its row 1); the other four are in neither of its tasks. Send the coordinator that list for workstream 2's
  task 9b, so each is built there or dropped by name; land none of it here.
- [ ] **Step 2: Gates** (knip and boundaries are the ones that catch a leftover), the examples' build, the
  examples' journeys.
- [ ] **Step 3: Commit:** `chore(extensions): room-visibility is not landed; workstream 2 builds the rooms a view draws`.

If the coordinator has answered otherwise before this task starts, follow the answer and record it here.

### Task 12: Every pass behind its switch; the effects' sheets; the pull request

**Files:**
- Modify: `packages/3d/tests/unit/look/look-pass-list.test.ts` (the branch's; it already holds the pass order)
- Create: `extensions/world-kit/tests/unit/sky/switches.test.ts`
- Create: `docs/superpowers/audits/builders-look-survey/after-effects/`

**Interfaces:**
- Consumes: `createLookPasses(look, time)` in core and the world kit's pass registration, as the branch has them.

- [ ] **Step 1: The tests, written to the switches as they are** (plan audit, finding 3). Core's look has four
  switches in `features/look/library/look.json`, and on `main` and on the branch they read `outline: false`,
  `grade: true`, `dither: true`, `haze: true`. `createLookPasses` puts a `GradeEffect` in the list whenever `grade` is
  on, and the grade changes nothing until a mood is named; so `DEFAULT_LOOK`'s list is haze, grade, snap, present, and
  that is right. The branch's `look-pass-list.test.ts` already proves the order with every pass on and the present
  pass's rules. Add only what it lacks: with `DEFAULT_LOOK` the list is exactly `[HazeEffect, GradeEffect,
  DuelSnapEffect, PresentEffect]` (no outline); `switches.outline: true` adds exactly the outline, after the snap;
  `switches.grade: false` and `switches.haze: false` each take exactly their pass out; and a frame drawn with
  `DEFAULT_LOOK` equals the same frame with `switches.grade: false`, pixel for pixel, while no mood is named (a browser
  case beside the branch's grade test). For the world kit, on `skyLookPasses` (pure, so a unit test): with no options
  it gives exactly `world-kit:stars` and `world-kit:glow` (both on unless told `false`; the glow since #589); with
  `stars: false, glow: false` and nothing else it gives none; `reflect`, `shafts`, `particles` and `rain` each add
  exactly their own name, in the order of `SKY_PASS_NAMES`. If a case fails, read the code before touching it: a test
  written against a switch the code does not have is the test's fault; a pass that joins while its own switch is off
  is the code's.
- [ ] **Step 2: The day sheets do not move.** Shoot into `after-effects/` with painted figures and the spike's effects off
  (third argument `figures=painted&fx=0`). Each scene panel's brightness is within 2.0 of `after-figures/`'s. Outside it: stop and report.
- [ ] **Step 3: The effects themselves.** Shoot the branch's night set (its README under
  `docs/refactor/eb-look/effects/` has the command) into `after-effects/night/`. Look: a street lamp's shaft in
  whole steps, the coloured outline round the post and the bin. Write `after-effects/README.md`.
- [ ] **Step 4: Gates, suites, record, commit, push, draft pull request:**
  `feat(3d): the look's effects, each behind its switch (#590, #588)`. When it merges, #590 and #588 show as
  merged; one comment on #588 says which of its three extensions landed and why the third did not.

---

## Group 4: what the ward's figures need from the wardrobe

FigureBuilder's cycle `c9-wardrobe` has a spec, an audited plan and six of ten tasks built on its branch
`claude/c9-wardrobe` (draft #29 there): sheer cloth, the shod foot, the head's form, front hair, hair that rests on
the trunk, a fringe and three styles. Its plan is
`docs/superpowers/plans/2026-11-11-c9-wardrobe.md` in that repository and is the step-level text for tasks 13 to
15: read it there. This plan says only what is in, what is out and what differs.

### Task 13: FigureBuilder: drawn moods, the wardrobe golden, the merge

In the FigureBuilder repository, by a session with push access to it (a framework session has none).

- **In:** its task F8, "The drawn moods" (`fear`, `sad`, `worried` and `firm` drawn, `EXPRESSIONS` gaining `worried`
  and `firm`; generic to the pipeline: this is the survey's "faces" row), its Checkpoint B cut to the faces sheet (no
  marks sheet without glyphs), and its task F9, "The wardrobe golden, the docs, the merge".
- **Out:** its Part 3, "The showcase" (S1, S2: Ada and the Nurse in FigureBuilder's showcase). Ada and the night
  figure are the game's, dressed by workstream 2's task 13 from the kit's entries (finding 9).
- **Out, unless the Owner asks:** its task "Glyphs" (tiny text on a watch and a badge). A badge cannot carry
  initials at density 2 (its own audit measured 6 to 9 texels), and the prologue needs none. Record it in the
  survey's table as not wanted only with the Owner's word; until then it reads "not started, not planned".
- [ ] Its own gates: `npm run typecheck`, `npm test` (its goldens fail on one texel), `npm run view-check`. Its new
  golden (`tests/golden/wardrobe.json`) is a recording; no golden on FigureBuilder's `main` moves. Two expected
  re-records are not a stop: F8 replaces the `face/fear@D*` and `face/sad@D*` pins that F0 made on the same branch
  (they pinned today's neutral-looking faces, and F8 draws them), in the commit F8 names. Anything else that moves is a
  stop (finding 9).
- [ ] Merge to FigureBuilder's `main`; tell the coordinator the commit.

### Task 14: The kit on FigureBuilder's `main`; the door

`claude/builders-look-wardrobe`, from `main` after group 2. The other repository's plan, "Part 2", tasks "The
submodule at FB main" and "The door".

- [ ] **Step 1:** Move the pin to task 13's commit: `git -C vendor/FigureBuilder fetch && git -C
  vendor/FigureBuilder checkout <commit>`, `git add vendor/FigureBuilder`. Gates and the kit's suites with no kit
  change: green, the runway golden unmoved. If it moves, stop: the builder changed a cell it promised not to.
- [ ] **Step 2:** The door re-exports what the new kinds use (that plan lists the names); `door.test.ts` and
  `contract.test.ts` pin them. Commit `chore(character-kit): FigureBuilder at its main; the door takes the wardrobe's names`.

### Task 15: The ward's clothes as kit entries; moods reach the painter

That plan's tasks "The kinds" and "Expressions reach the painter", cut to the ward.

**Files:**
- Create: `extensions/character-kit/src/features/fashion/{hosiery,boots,cap,tabard}.ts`,
  `extensions/character-kit/src/features/fashion/ward-outfits.ts`, their tests under
  `extensions/character-kit/tests/unit/fashion/`
- Modify: `garments.ts`, `shells.ts`, `register-fashion.ts`, `src/entries/index.ts`

**Interfaces:**
- Produces: the garment kinds `Hosiery`, `Boots`, `Cap`, `Tabard` as that plan's "Interfaces" block defines them
  (item fields never take a kind's name; seams from 4100, a block of ten a kind).
- Produces: `WARD_OUTFITS: readonly { name: string; garments: Garment[] }[]` with exactly these names:
  `ward-uniform` (a dress to the knee, a tabard with a cross-over back, a folded cap, opaque hosiery, low shoes),
  `ward-uniform-night` (the same in the wardrobe's darkest steps, no cap), `street-1979` (a coat, a jumper, a
  skirt with no gathers, hosiery, ankle boots). No entry names a character of the game.
- Out: `Badge`, `Watch` (they need glyphs), rolled and three-quarter sleeves, the pleated skirt.
- Produces, as that plan's task A4 defines them (plan audit, finding 7): `PaintedState.expression?: Expression` (one
  of FigureBuilder's `EXPRESSIONS`: `neutral`, `fear`, `surprised`, `sad`, `angry`, `talk`, `smile`, `dead`,
  `worried`, `firm`; the drawn face, which the spec and the survey call a mood) and `PaintedState.mood?: readonly
  string[]` (the builder's mood tags, such as `talk` and `lookL`, ignored by a held pose). A name the builder does not
  have throws in words the first time the entity is drawn, as `pose` and `outfit` do today.
- No changeset: that plan's A3 step 6 adds one for `@automata/character-kit`, which is private
  (`"private": true`), and `AGENTS.md` gives changesets to published packages only (finding 8).

- [ ] Tests first, kind by kind, as that plan's task orders them: each kind's fit test on the base pair's slider
  extremes, then `WARD_OUTFITS` painted on the base woman in 4 directions against a new golden of md5s
  (`tests/fixtures/goldens/ward-cells.json`, a first recording, made once and committed with the commit that names
  it). The runway golden does not move. The new golden is one golden for every machine, as #607 made the runway's:
  its cells are drawn again under `ulp.test.ts`'s nudge (the maths a last bit off) and must keep their md5s, and a cell
  that moves under the nudge is fixed in FigureBuilder, never given a per-arch entry (that plan's A6, P1; finding 18).
- [ ] One commit a kind, then `feat(character-kit): the ward's outfits, and a figure's expression`.

### Task 16: The ward gate sheet; the pull request

- [ ] **Step 1: The sheet.** With the kit's gate script (`pnpm --filter @automata/character-kit gate`, as the c7
  gate was made), or the survey's shoot script, draw the base woman in each of the three outfits, 8 views, at
  density 2, lit in the base interior: `docs/superpowers/audits/builders-look-survey/ward/`. Look at every cell and
  write its README: what reads as a nurse's uniform at this size and what does not.
- [ ] **Step 2: Stop for the coordinator** with the sheet: this is the picture the Owner judges the ward's figures
  by before the prologue wears them.
- [ ] **Step 3:** Gates, suites, record, push, draft pull request:
  `feat(character-kit): a ward uniform, street clothes and moods for painted figures`. When it merges, tell the
  coordinator that workstream 2's dressing has the ward's entries (`WARD_OUTFITS`) on `main`.

---

## Group 5: the record

### Task 17: The survey's table re-measured, the pull requests settled, the builders' fate asked

`claude/builders-look-record`, from `main` after everything above has merged.

- [ ] **Step 1: Re-measure.** Re-shoot the survey's sheets on `main` into `final/` and go through the survey's
  table row by row. Each row now reads "on `main` and working", with its test named, or "not wanted", with the
  Owner's word quoted, or it is still open: list those plainly. Then the survey's "Remainders the drafts name
  themselves", line by line, the same way. Expected to stay open without the Owner's word: a figure's cast shadow,
  glyphs, the fixed-angle window, the bloom's colour-match mask, a closed door that does not stop light (tell
  workstream 2: the prologue has doors and a lights-out state), patterns and grime as ladders, WebGPU on a real GPU.
- [ ] **Step 2: The pull requests.** #588, #589, #590, #603 and #607 show as merged, each with its comment, and so do
  #587, #601, #602 and #604 (task 5). If one does not (its head was not in the merge), close it with the reason.
  FigureBuilder #29 is merged by task 13.
- [ ] **Step 3: The gates whole** (`pnpm check`) and the 3D browser suites in
  Chromium. List what did not run: WebKit, Firefox, WebGPU on a real GPU.
- [ ] **Step 4: Ask, do not do.** The spec's third call is the Owner's: fold FigureBuilder's code into the
  character kit so the framework builds from its own repository, or keep the submodule and make FigureBuilder
  public. Send the coordinator the two options with what each costs (the kit's door is two files and one test holds
  it the only importer; the builder's working tree is 20 MB at `d6e3c9f`, 46 MB with its history, measured by the plan
  audit). This plan stops there.
- [ ] **Step 5:** Update the survey's table in place with a dated line, `progress.md`, and this plan's tracking
  table to 17 of 17; commit `docs(superpowers): the builders' look, measured again on main`; push; draft pull request.

---

## Calls made in this plan, for the coordinator to check

1. **#589 lands first, inside "the lit room healthy".** The fix depends on its code. The spec's order is kept in
   every other respect.
2. **Bring branches in by merge, not by rewriting.** Each was cut from one commit of `main`, merges cleanly and was
   audited in its own cycle; a rewrite would lose that and gain nothing.
3. **`room-visibility` does not land;** `lcd-panel` and `retro-crisp` do. The plan audit found the first already
   ruled by the Owner's decisions (#588's clinic work is superseded by workstream 2).
4. **#607's re-recorded runway golden is accepted as ruled** by that cycle's coordinator, checked in task 6 to be
   the only golden that moves.
5. **Exposure is measured before it is ported.**
6. **A figure's cast shadow is a named difference, not built,** until the Owner says.
7. **Glyphs are out;** drawn moods are in.
8. **The kit names no character.** It ships outfits; the game says who wears them.
9. **The two dark examples are repaired** although they are to be cut, because each repair is a few lines and each
   exposed a guard that was missing.
10. **Painted figures stay data in TypeScript** (as `RUNWAY_CAST` and `DEMO_CAST` are). No editor opens them:
    the Studio edits core's mesh figures, and workstream 2's dressing task says it makes its figures in the Studio.
    Under the Owner's rule that every kind of authorable content has an editor, this is logged as row 2 of the
    tracker's editor gaps ledger. It is suite work, not this workstream's; until it is built, the game's painted
    characters are a data file in the game.
11. **The letterbox's whole-pixel scale** is the one change to `@automata/framework`. The plan audit ruled: keep it
    (the homes table says why and what reverting would take); the coordinator puts it to the Owner.

## Log

| Date | Session | What |
|---|---|---|
| 2026-11-11 | Stage 2 (plan), `claude/builders-look-plan` | The survey and this plan, planned against the spec at `44c4da09` (unchanged since) and `main` at `f93a2402`. No product code written |
