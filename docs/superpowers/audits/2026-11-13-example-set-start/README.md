# The example set's start: implementation audit of F1, F3 and W1 to W3, and the join

Branch `claude/example-set-start`: `origin/claude/example-set-f3` (`bf60592f9`, on F1 `ea167e283`), then `origin/main`
(`a234a3a20`) merged, then `origin/claude/example-set-world` (`5212b7bde`) merged. Plan:
[`../../plans/2026-11-13-one-example-set.md`](../../plans/2026-11-13-one-example-set.md); spec and plan audit beside it.
No pull request, no force-push, no workflow file changed, no publish. Tracker files untouched; their rows are at the end.

## The join

- f3 + main: one conflict, `biome.json`'s ignore list. Kept both sides (F3's `site/static/scenes`, `site/build-scenes`;
  main's `extensions/world-kit/tests/fixtures/builder-tiles.json`).
- + world: no textual conflict, **but one semantic one** (finding H2 below): main's frozen tile golden and the world
  branch's two new photos made the kit's unit suite fail once joined.
- None of the three branches edited `docs/refactor/progress.md`, `docs/status.md` or `docs/superpowers/progress.md`
  (`git diff --stat origin/main...origin/claude/example-set-<x>` on each printed nothing).

## Findings, by severity

### High

**H1. A 3D page would have served the private `@automata/3d` (F3).** `sceneExamples` left out an example whose *own*
imports name an unpublished extension. Every real scene example imports only `@af-examples/set-3d` and the umbrella,
and the set's package depends on `@automata/3d` (unpublished, on the closed `@pixi/3d` beta). So once E1 lands, the
reader would have returned it and `buildScenes` would have built and served the 3D runtime. The pruning in
`site/scripts/scenes.ts` is sound for what it is asked (it keeps exactly the shown pages and the chunks they name), but
it was asked the wrong question. **Fixed** (`8dfc204a1`): `setNeedsPrivate` reads the set's `package.json`; an example
importing the set is left out while any of the set's dependencies is an unpublished extension or a private workspace
package. A fixture `scene-station` (importing only the set) failed first (`expected [ 'scene-lamp', 'scene-station' ]`),
then passed. It is built in the fixture build with a stand-in, and given no page.

**H2. The joined branch failed the world kit's unit suite (join).** Main's builders fold added
`tests/unit/textures/builder-tiles.test.ts`, which asserts that the kit's photos make exactly the frames of the
source's frozen, sha-pinned golden. The world branch added `ballast` and `sleeper`. Joined: 7 failures (the key check
and the six md5 checks for the new photos). **Fixed** (`d3a4d8551`): the test names the photos the kit gained after the
source (`LATER_PHOTOS`), leaves them out of the md5 checks, and fails if any other photo appears or one goes.
The golden file is unchanged (its sha check still passes).

**H3. The page's Play was a decoy (F3, open point a).** The frame showed the game's own title and a second Play.
**Fixed** (`3fb40a789`, `97eed1a01`): `startAtPlay` moved from the playground into the runner
(`@automata/examples-runner/start-at-play`, the playground re-exports it). Each example page the runner writes starts at
play when its address has `?play`; without it, nothing changes (the examples' own host does not add it). `SceneFrame`
loads `frameUrl + '?play'`. The new e2e checks that one press reaches `[data-screen="play"]` with no title and no Play
button inside the frame, at three sizes. Red first in the runner's unit test (the page had no such import).

**H4. Escape then lost the keys again (found by H3's fix).** Once the game is at play, focusing Stop blurs the frame.
The web host reports the blur as the lifecycle reason `blurred`, the game pauses, and the flow focuses the pause
screen's Resume, which pulls focus from the page back into the frame. The old e2e passed only because the title screen
does not pause. **Fixed on the page** (`97eed1a01`): Escape is read in the frame's capture phase and kept from the game.
After Escape the frame may not take focus until the visitor presses inside it or tabs to it. Two e2e cases: the paused
screen opens and Stop keeps focus; a press on Resume gives the keys back. **The framework side is the coordinator's**
(C1 below).

### Medium

**M1. A phone held sideways had Play below the fold (F3, open point b).** **Fixed** (`97eed1a01`): the 2D pages' order for
that shape, the stage first and the words after it; portrait and desktop keep the words above. The stage's Play sits at
its top in that shape, so it is on the first screen under the page's title. On Play the stage scrolls fully into view.
The e2e now runs at 390 × 844, 844 × 390 and 1280 × 800 and asserts the order and Play inside the first screen with no
scroll. The first green run showed Play's bottom at 398.5 px of 390 even with the order fixed; the stage-top Play
cleared it.

**M2. The canopy and the ticket window do not read (W2, W3), not fixed here.** Both are as the coordinator found them:
the canopy is a green slab on two thin posts, its braces hidden behind the fascia; the ticket window is a counter, two
green pillars and a pane. Out of time in this session: the reshape (a row of posts with brackets and a valance edge; a
framed window with a sill and a grille or hatch) is the next session's, test first.

**M3. The trunk's straps stood past the lid's edges (W3).** **Fixed** (`d3a4d8551`, in the same commit as H2: a failed
pre-commit left the trunk's files staged, the commit took both, and it was pushed before I saw it; with no force-push it
stays one commit). Each strap is now the body's and the lid's own rounded shapes, slightly proud of them. The test
compares the strap's and the lid's highest points near the front and back edges; it failed first (0.495 m against the
lid's 0.493 m). The sheet `w3-indoor.png` was not re-rendered: the renderer is a scratch script not in the repository.

### Low

- **L1. F1's note on the config loader overstates it.** `pnpm exec vite build` in `examples/3d` with the default loader
  builds fine (exit 0, measured here: Vite 8's bundling loader inlines the workspace packages, which resolve outside
  `node_modules`). `--configLoader runner` is harmless and is on every path I found: `examples/3d`'s `build` and
  `e2e:examples` (which the Playwright config and `3d.yml`'s `pnpm --filter @af-examples/examples-3d test:e2e` run),
  `automata-examples dev` (the runner CLI: `pnpm examples:3d`, and the 2D examples' dev too) and the site's
  `buildScenes`. One path runs without it: `extensions/character-kit/scripts/gate.ts` (`pnpm exec vite build` in
  `examples/3d`). It works for the reason above; E5 owns that file.
- **L2. A comment in `catalog.ts` is wrong for `@automata/3d`.** The block added to `EXTENSION_PACKAGES` says the nine
  are "absent from `UNPUBLISHED_EXTENSIONS`"; `@automata/3d` is in it. The rule itself holds: once a kit is published
  (not private, in `EXTENSION_PACKAGES`) its entries become public and `sceneTier` still calls it a kit. `@automata/3d`
  and `figures` stay core for a scene's tier. The fixture test (e) covers the published case. Not changed (a comment).
- **L3. `SCENE_CAST` is empty and nothing pretends otherwise.** `scene()` checks `cast` against it and names the empty
  list. The F3 fixture never calls `scene()`. `cast` is accepted and unused until F5; the type says so.
- **L4. The sticky site header covers the top of the stage after Stop is focused** (the browser scrolls to Stop). A
  visitor scrolls back; the e2e does so before pressing in the frame. A site-wide `scroll-padding-top` would cure it.
  Not done here.
- **L5. Two tiles, measured, left to the look tasks.** `ballast`: 128 × 128 texels at 32 a metre (4 m, the photo's 2 m
  at `scale 2`), slate step 3, `flatten 0.7`, `cluster 2`. In `w1-tiles.png` it is two-to-four-texel blotches of three
  greys, which reads as camouflage. `sleeper`: 16 × 16 texels, the photo's own 0.5 m, so it repeats every half metre.
  The 4 × 4 sheet shows the same crack sixteen times.
- **L6. The kit's "without the kit" pattern** (`tests/unit/props/without-kit.test.ts`: core names the missing
  generator) covers one kind, `chair`. No railway kind has its own case. Each is checked registered, drawn without a
  preset, and resolvable by preset of its name (`railway.test.ts`). I did not add seven negative cases.

## Checked and sound

- **Photos** (W1): rows in `photos.json` as the kit records them (`file`, `size`, `source: polyhaven:<id>`,
  `licence: CC0`, credit with name, author and URL). Poly Haven's API agrees: `gravel_stones` "Gravel Stones" by Amal
  Kumar, 2000 mm; `rough_wood` "Rough Wood" by Rob Tuytel, 500 mm. I downloaded each 1k diffuse PNG from
  `dl.polyhaven.org` and scaled it with Lanczos to 256 and 128 px. The mean difference from the committed files is
  0.0 per channel: they are what Poly Haven serves.
- **No station name in the kit**: no `station`, `porter`, `stationmaster` or `traveller` in `railway.ts`,
  `props.json` or the README.
- **Nothing recorded moved**: `git diff --name-status origin/main...HEAD` over tiles, goldens, hashes and
  `screenshots-approved.json` shows only the two added tiles.
- **`/scenes/` headers**: `FRAMEWORK_BUILD` gives it the demos' whole policy, with its own `_headers` rule; unit-tested
  (`security-headers.test.ts`, `headers.test.ts`).
- **Press before hydration**: `data-play` and the site's first-press script; unit test and e2e (the focus tests click
  at once after `goto`).
- **48 px Play, no sideways scroll**: asserted at all three sizes.
- **Nothing of The Last Light is imported or named** in `examples/set-3d`, the runner, the site's new code or the kit
  (the only hit is the site's banned-phrase list).

## For the coordinator (decisions)

- **C1. The framework's blur-pause takes focus.** In `packages/automata`, a screen entered while the game's document
  has no focus still focuses its control (`flow.manager.ts` step 7). With the web host's `blurred` reason, any embed
  (the site, an itch.io page) that hands focus out of the game gets it pulled back. Fix candidates: skip that focus
  when `document.hasFocus()` is false and the change was not the player's, or do not pause on blur in a frame. It
  touches every 2D and 3D journey's first focus, so it needs its own task and the GPU runner.
- **C2. The base for F2, Part K, L1 to L4 and F5** now that the joined prologue branch will not come (below).
- **C3. Whether the canopy and ticket-window reshape (M2) is a fix session before L1**, or folded into L2's dressing.
- **C4. The 3D workflow's paths** (`examples/set-3d/**`, `examples/3d-story/**`) remain the Owner's end-list item,
  as the plan says.

## What the scrapping changes

The Owner: "scrap the last light; we'll do a brand new microgame with same features; a systemic horror game". The
plan's lines that wait on, name or import it (marked in the plan with a dated note; not rewritten):

| Where in the plan | What it says | What changes |
|---|---|---|
| Tracking table: F2, L1, K1 "after the joined prologue branch"; the order diagram; "What waits" (F2, Part K, every Opus task) | they start once `claude/last-light-camera` and `-ada` are merged into `claude/last-light-prologue` and it is on `main` | that branch will not come. The features its check table names (`peekReach`, `fitFocus`, `dimmest`, `bobOpen`, `cellPixels`, the night fix) are still needed; how they reach `main` is C2 |
| "The base" paragraph and its check table | the prologue branch as the base | as above |
| L3 "the night fix" (`d246fb8f1`, "focus the haze on the player") | from the game's lane | needs a new owner if it is not on `main` |
| L4 and E1 (`peekReach`, `fitFocus`) | the game's camera branch | same |
| Dependencies table: "The game's plan (The Last Light)" row (Ada and the nurse as data with Part K's kind; `PLAY_FIGURE`, `fieldFor`, `wholeScaleFor`) | another plan carries it | no plan carries it. Part K stands for the set's three people; whether the new microgame takes the kind is its own plan's |
| Q3 (`fieldFor`, `wholeScaleFor` in `games/the-last-light/src/app`) | F2 lifts them into the framework, or "uses what landed" | nothing lands from the game; F2 writes them (it was written to, from the rule, not the game's file) |
| Part K: "the hardest case" (Ada and the night nurse on `origin/claude/last-light-ada` `45bef0c2e`), and its Done means "the game's lane can convert its cast with no new field" | the kind sized to the game's cast | that cast is scrapped; the kind's bar is the set's three people (and any field the new game later needs, added for everyone) |
| Global constraint "Nothing from The Last Light" | no file, model, swatch, line or number copied | unchanged, and easier |
| Shared files: "after the prologue lands whoever merges second reruns `textures`" | the world kit's tile pipeline changes on the game's branches | no longer applies unless those changes come by another way |
| Critical path | starts at "the joined prologue branch on `main`" | starts at C2's ruling |

Nothing on these branches' code imports or names the game.

## Pictures (opened, each)

The six page pictures, taken again on this branch against the fixture build (`scene-lamp`; Chromium; phones at 3×,
desktop at 1×), in this folder:

- `phone-portrait-before-play.png`: title, the words, the stage with its title and the lime Play (48 px), the controls
  line, difficulty, packages, the code. As before.
- `phone-portrait-after-play.png`: the frame holds the game **at its play screen**: black field and the game's own
  pause button (top right, focused). No second Play. The controls line and Stop under it.
- `phone-landscape-before-play.png`: header, the title on one line, then **the stage with Play on the first screen**
  (the old picture showed only the header, title and words). The words come after the code.
- `phone-landscape-after-play.png`: the stage scrolled fully into view under the sticky header, at play, pause button
  focused.
- `desktop-before-play.png` and `desktop-after-play.png`: words above, the stage 16:9; after Play the game is at play.
- In none of the after-play pictures does the fixture's own drawing (a coloured field and "A fixture room.") show: the
  field is black. Its play screen is reached (the e2e asserts `[data-screen="play"]`); whether the fixture's draw runs
  under headless software WebGL I did not chase. The title-screen pictures of the earlier session were black behind
  the title too.

F3's six (`../2026-11-13-example-set-f3/`): I opened each. They show the two weak points the notes raised (the
second Play in every after-play picture; landscape before-play is header, title and words only). The world sheets
(`../2026-11-13-example-set-world/`): `w1-tiles.png` (ballast camouflage, sleeper repeat, L5), `w2-railway.png` (the
canopy slab, M2; rails, edge and signal read), `w3-indoor.png` (the plain ticket window, M2; the trunk's strap tabs at
the back of the lid, visible, M3; the lever frame reads best). These sheets were not re-rendered after M3.

## Gates on the joined branch

See the table at the end, filled from the run's logs.

## For the tracker

Rows for `docs/superpowers/progress.md` and `docs/refactor/progress.md` (neither edited here):

| Task | State | Evidence |
|---|---|---|
| Example set: F1, F3, W1 to W3 joined | `claude/example-set-start`, no pull request | merges `8258785e9` (main, one `biome.json` conflict) and `b7a2fc668` (world, none) |
| Implementation audit of F1, F3, W1 to W3 | done; fixes H1 to H4, M1, M3 | `3fb40a789`, `97eed1a01`, `8dfc204a1`, `d3a4d8551`; this README |
| Open | canopy and ticket-window shapes (M2); the framework's blur-pause focus (C1); the base after the scrapping (C2) | this README |
