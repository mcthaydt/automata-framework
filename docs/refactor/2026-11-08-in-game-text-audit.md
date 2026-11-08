# Crisp in-game text: audit

The Owner, 2026-11-08 19:18, on a screenshot of `examples/2d/render/render-filter.ts`: "we can't ship with example text
looking like this - what are our options; I know of pmndrs glyph". At 21:11 the Owner picked "MSDF BitmapText on a crisp
layer" from the options compared in the thread "Fix blurry in-game text rendering".

Read as: every piece of text a game draws on its canvas is sharp on every screen, readable on a phone, the same in a 2D
and a 3D game, and drawn with Pixi's `BitmapText` from a baked multi-channel signed distance field (MSDF) font, on a
layer of its own above the pixel picture.

This is stage 1 (audit) of the pipeline. It was made on PR #522 (branch `claude/project-thread-fxu792`, head
`5cf0825b`), the stack head that holds Feel, the shared editors and the new-game templates. The site line (PR #521,
`claude/project-thread-k1ftgu`, head `4ae221c1`) has the same text users; checked with the same search. Every finding
says what was run or read.

## The answer

1. **Two things draw text on a game's canvas, and both are blurry today:** `draw(ctx).text` (six examples) and Feel's
   words (every new 2D and 3D game: "Bump!" when the player hits a wall, and whatever a person writes in Feel's "Show a
   word"). Menus, dialogue and captions are DOM and already sharp.
2. **The cause is where the text is drawn, not the font.** It is drawn inside the fixed-size pixel picture (the composite)
   and that picture is blown up with nearest sampling, under the post filters. No font technology fixes it while it
   lives there (T1).
3. **On a phone it is also too small.** In a new 2D game held upright on an iPhone 15 the word's letters are 5.5 CSS px
   tall (T2).
4. **The picked approach works, in 2D and 3D, from the editors to play.** A throwaway prototype (a layer above the
   composite, Feel's words as MSDF Geist SemiBold) made the word sharp in a new 2D and a new 3D game made in the editors
   and played, at iPad and phone size (`compare-word.png`).
5. **Four things the picked approach does not give for free:** letters outside the baked set vanish silently (T3, which
   corrects an earlier note in the thread that Pixi builds them on the fly), MSDF in Pixi draws no outline (T4), pixel
   art makes the atlas sample wrongly unless loaded with care (T5), and the font must reach every target without a
   request the target refuses (T6).

The comparison (today on the left, the prototype on the right, all four cases) is
`/mnt/project-files/text-rendering/audit/compare-word.png`.

## What was done by hand

In a cloud container (Node 22.23.4, pnpm 10.34.6, Chromium from `/opt/pw-browsers`; WebKit and Firefox are not installed
here), on a worktree of `5cf0825b`:

1. `pnpm install --frozen-lockfile`, `pnpm build` (16 of 16 tasks), `pnpm --filter @automata/editors build`: all exit 0.
2. **A new 2D game and a new 3D game, made in the editors and played.** A throwaway journey
   (`/mnt/project-files/text-rendering/audit/zz-text-audit.test.ts`, in the shape of the complete-game journeys:
   `automata create-game`, packages linked from Emberwick's or base-3d's install, the built `automata editor`). In Feel,
   on "square bumped" (2D) and "wick bumped" (3D), the word's "What it says" was changed from "Bump!" to "Ouch, a wall!"
   and its "How long" to 5000 ms; the file was written with no Save, and the game served it (`servedWith`). Play opened
   the game; holding Left (2D) or D (3D, held sideways) into a wall showed the word. An init script kept the drawing
   buffer and copied the frame with the most white pixels, so the shot is the exact frame the player saw. Run with
   `playwright test -c playwright.journeys.config.ts zz-text-audit --project editor-ipad-chromium --project
   editor-phone-chromium`: 4 passed. **Made, played, seen: the word shows in both kinds, and it is blurry in both.**
3. **The same four games with the prototype** (`prototype-crisp-layer.diff`): a `hud` container added to `frame.root`
   after the composite sprite in `createPixiRenderer`, the font loaded with `Assets.load`, and Feel's words drawn there
   as `BitmapText` in Geist SemiBold (baked with `msdf-bmfont-xml` 2.8.0, ASCII, 42 px, range 4), with a dark copy
   offset 1.5 CSS px behind for contrast and a 14 CSS px floor. 4 passed. The page reported `BitmapText MSDF` for every
   word. **Sharp in 2D and 3D, at both sizes, under the 3D package's no-eval uniform shim.** The 3D word sat at the
   screen's middle (195, 90 of the 390 by 180 field), where Feel puts a word with no subject.
4. **Letters outside the atlas:** the 2D game again with the word "Aïe, un mur ! 好" and the ASCII atlas. Play showed
   "Ae, un mur !": the ï and the 好 were dropped without a word (`after-missing-glyphs-2d-ipad-x3.png`).
5. **The baker:** Geist SemiBold from `geist` 1.9.2 (OFL 1.1, `LICENSE.txt`), baked at 24, 32 and 42 px for ASCII,
   ASCII plus Latin-1, and ASCII plus Latin-1 and Latin Extended-A. Two bakes of the same input gave the same sha256 for
   both files. Sizes are in T7.
6. Code read: `draw-layer.ts`, `composite-target.ts`, `letterbox.ts`, `canvas-resolution.ts`, `renderer.ts`,
   `feel-stage.ts`, `packages/3d/src/app/create-renderer.ts` and `characters-3d.ts`, the content font build
   (`packages/content/src/shared/assets/build-fonts.ts`), the site's policies (`security-headers.ts`,
   `src/features/playground/headers.ts`) and Pixi 8.22.0's text code (cited below).

The prototype and the journey are throwaway and are not in this pull request. Screens, the diff, the journey and the baked
font are in `/mnt/project-files/text-rendering/audit/`; the first comparison (`compare-desktop.png`, `compare-phone.png`)
is one folder up.

## Where text on the canvas comes from

| Source | Code | Who uses it | Today |
| --- | --- | --- | --- |
| `draw(ctx).text` | `packages/automata/src/app/draw/draw-layer.ts:103` (a pooled Pixi `Text`, default 8 logical px, Pixi's default family, Arial) | `examples/2d`: `render-filter`, `render-quality`, `render-interpolation`, `shapes-draw-hud`, `core-host-lifecycle` (8 px), `core-basic-window` (16 px); all 320 by 180. They are also on the site's examples pages and playground. | Blurry; striped by post filters in `render-filter` |
| Feel's words | `extensions/feel/src/app/feel-stage.ts:96` (a pooled `Text`, 10 logical px, white with a 2 px black stroke) | Every new 2D and 3D game (`template-content/feel/feel.toml:7`, `template-3d-content/feel/feel.toml:7`: "Bump!"), and every word a person adds in Feel | Blurry; too small on a phone |
| Dialogue, captions, menus, pause, toasts | Svelte DOM (`extensions/cutscenes/src/features/caption/Caption.svelte`, `narrative`, `ui-screens`, `packages/automata/src/shared/ui`) | Every game | Sharp: not in scope |
| The 2D editor's canvas labels | `packages/editor/src/shared/level-2d/canvas/scene-items.ts:130` | The editor only | Already screen-sized (`resolution: 2`, scaled by `1/zoom`): not in scope |
| Emberwick's overlay | `games/emberwick/src/features/scene/scene.ts:129` | Emberwick | A vignette and a flash, no text |

Nothing else in `packages/`, `extensions/`, `games/` or `examples/` makes a Pixi `Text`, `BitmapText`, `HTMLText` or
`SplitText` (searched on both stack heads).

## Findings

### T1 (high). Canvas text is drawn inside the pixel picture

`createDrawLayer` mounts its `Text`s on `stage.ui` (`draw-layer.ts:125`) and Feel adds its words to `stage.ui`
(`feel-stage.ts:103`). With pixel art on (the default, and what `defineGame` sets), `CompositeTarget.adopt` moves `world`
and `ui` into its own stage (`composite-target.ts:51`), which renders each frame into a texture of the logical size at
resolution 1 (`composite-target.ts:33`, `renderer.ts:320`), and that texture's sprite is scaled up in `frame.root` by
view width over logical width (`letterbox.ts:124`, `:140`) with nearest sampling. The post filters sit on the composite's
stage (`renderer.ts:245`), so `dusk` dims the text and `scanlines` stripes it. An 8 px string is therefore 8 texels tall
whatever the screen, then blown up by a factor that is rarely whole (2D game on an iPad upright: 834 / 512 = 1.63).

The same holds in 3D: `createPixi3dRenderer` builds on `createPixiRenderer` (`create-renderer.ts:250`), the look's target is
the same composite (`packages/3d/src/features/look/target-size.ts:1`), and Feel's words land in `stage.ui` there too.

Without the composite (`pixelArt: false`, which no game or example uses) the text is still soft once the field is scaled
up, because a `Text` with automatic resolution uses only the renderer's resolution, never the scale above it
(`pixi.js/lib/scene/text/canvas/CanvasTextPipe.mjs:43`).

**Fix:** a layer above the composite sprite and outside the post filters (T9). Measured in step 3.

### T2 (high). Too small on a phone

Feel's word is 10 logical px, `ctx.text` 8 by default. Measured from the played frames (the white letters' box, step 2),
and computed for the examples from the letterbox scale (they fill the width):

| Where | CSS px per game px | Font today | Letters today | Letters, prototype |
| --- | --- | --- | --- | --- |
| New 2D game (512 by 256), iPhone 15 upright (393 by 659) | 0.77 | 7.7 px | 5.5 px | 12.0 px (14 px floor) |
| New 2D game, iPad Pro 11 upright (834 by 1194) | 1.63 | 16.3 px | 11.0 px | 14.0 px |
| New 3D game (390 by 180), iPhone 15 sideways (659 by 393) | 1.69 | 16.9 px | 12.0 px | 15.0 px |
| New 3D game, iPad sideways (1194 by 834) | 3.06 | 30.6 px | 21.5 px | 27.5 px |
| An 8 px `ctx.text` example (320 by 180), phone upright | 1.23 | 9.8 px | | |

The game's own DOM text is 16 px body and 13 px small (`packages/automata/src/shared/ui/theme.css:27`). A word at 5.5 px
fails the drunk grandma test outright. A floor in CSS px is needed (T10); the prototype's 14 px floor made the phone word
readable (step 3).

### T3 (high). A loaded MSDF font has no fallback: missing letters vanish

The thread's note said Pixi builds letters outside the atlas on the fly. It does not, for a loaded font.
`BitmapFontManager.getFont` returns the font cached under `<family>-bitmap` and calls `ensureCharacters?.(text)`
(`pixi.js/lib/scene/text-bitmap/BitmapFontManager.mjs:59-61`), which only the dynamic (canvas-made) font has
(`DynamicBitmapFont.mjs:71`). The pipe then draws only the characters the font has (`AbstractBitmapTextPipe.mjs:87`).
Step 4 showed it: "Aïe, un mur ! 好" drew as "Ae, un mur !". Feel's words are translatable text (`feel-stage.ts`
`translate`, and its unit test already plays "Aïe !"), so a French game would lose letters without a warning.

**Fix:** ours to build. For a string with any character the atlas lacks, draw the whole string as a crisp canvas `Text`
at the layer's device scale (renderer resolution times the root's scale), so mixed faces never sit in one word. Say once
in development which characters fell back. The content build already holds every language's messages to its DOM fonts
(the glyph gate in `packages/content/src/shared/assets/build-fonts.ts`); the same gate can warn when a Feel word in some
language needs the fallback.

### T4 (medium). MSDF draws no outline

Pixi's MSDF shader computes only the fill (`pixi.js/lib/scene/text/sdfShader/shader-bits/localUniformMSDFBit.mjs:51`); a
style's `stroke` only pads the layout (`AbstractBitmapTextPipe.mjs:61-64`). Feel's words rely on a 2 px black stroke
today. Without it, white letters on the 3D room's floor (0x7b7898) are 4.2 to 1, and on the 2D template's wall (0x887b58)
4.2 to 1. The prototype's dark copy, offset 1.5 CSS px, read well on both (step 3). An outline from the distance field
would need our own shader; not recommended for v1.

### T5 (medium). Pixel art samples the atlas wrongly unless it is loaded with care

`createPixiRenderer` sets `TextureSource.defaultOptions.scaleMode = 'nearest'` for pixel art (`renderer.ts:145`), so a
font atlas loaded after it is nearest-sampled, which breaks an MSDF's edges. The prototype switched the default to
`linear` around `Assets.load` and back. The build should create the atlas texture with `scaleMode: 'linear'` explicitly
and test it.

### T6 (medium). The font has to reach every target

The prototype loaded `/hud-font/Geist-SemiBold.fnt` from the game's dev server. A root path breaks for an itch zip served
under a sub-path, and the site adds two more constraints: its demos run under `connect-src 'self'` and
`img-src 'self' data: blob:` (`site/src/shared/html/security-headers.ts:25-26`), and its playground frames have an opaque
origin, so every file they load needs CORS (`site/src/features/playground/headers.ts`). Ruken and Tauri add their own
packaging.

**Recommendation:** ship the font inside the framework's JavaScript: the metrics as data and the atlas as bytes made into
a `data:` URL or a `Blob`. No request, no base path, nothing for any target or policy to refuse. The cost is the atlas'
size (T7), paid only by a game that draws text, if the plan loads it on the first text.

### T7 (medium). What the font costs

Geist SemiBold, MSDF, range 4, measured (`png` is the atlas; `metrics gz` is the gzipped XML with zero kerning pairs
removed):

| Bake size | Characters | Atlas | Atlas bytes | Metrics gz |
| --- | --- | --- | --- | --- |
| 24 px | ASCII (95) | 256 by 256 | 49,625 | 5,313 |
| 32 px | ASCII (95) | 256 by 256 | 68,415 | 6,954 |
| 42 px | ASCII (95) | 512 by 256 | 94,121 | 7,627 |
| 32 px | ASCII, Latin-1 and quotes, dashes, ellipsis, bullet, euro (199) | 512 by 256 | 154,927 | 19,938 |
| 32 px | ASCII, Latin-1, Latin Extended-A and the same marks (329) | 512 by 512 | 271,789 | 60,940 |

An MSDF atlas barely compresses (94,121 bytes gzip to about 88 KB; as base64 inside JavaScript it is 125,496 bytes,
91,948 gzipped). Kerning grows with the square of the set: the ASCII bake writes 2,655 pairs, 976 of them zero; the
Latin Extended set writes 41,711. **Recommendation:** 32 px, ASCII plus Latin-1 and the marks above (covers English and
the Western European languages), zero pairs dropped; everything else takes the T3 fallback.

### T8 (medium). The baker's traps

`msdf-bmfont-xml` 2.8.0 (MIT) works, but:

- its text format (`-f txt`) leaves out the `distanceField` line, so Pixi reads the font as a plain bitmap font
  (`bitmapFontTextParser.mjs:43-48`); the XML format writes `<distanceField fieldType="msdf" distanceRange="4"/>`;
- it ships prebuilt `msdfgen` executables per platform (`bin/linux`, `bin/darwin`, `bin/darwin_arm64`, `bin/win32`), so
  bytes may differ between machines (only one machine was tried);
- it writes every kerning pair, zero ones included.

**Recommendation:** bake on demand with a command in `@automata/tools` (Node, where Effect is allowed), commit the output
with the source's sha256 and licence the way `content/fonts.toml` records a font (`fonts.schema.ts`), and have the check
verify the committed files against that record rather than bake again. `msdf-atlas-gen` (MIT, C++) is the alternative if
the plan wants a pinned build instead of shipped binaries.

### T9 (medium). The stage has no place for it, and the order changes

`PixiStage` has `world`, `ui` and `backdrop`; nothing sits above the composite sprite. `DrawLayer.setup` takes
`Pick<PixiStage, 'ui'>` (plus `world`), and Feel adds to `stage.ui`. The layer belongs in core: created in
`createPixiRenderer` in `frame.root` after `composite.adopt` puts the sprite there (`renderer.ts:222`,
`composite-target.ts:52`), and after `ui` when there is no letterbox. It then inherits the root's scale (so it keeps
logical coordinates: `stage.characters.point`, which both the 2D and the 3D answer give in `ui`'s coordinates, needs no
change) and the root's mask (`letterbox.ts:102`, so text stays inside the field). The 3D renderer gets it for free
through `createPixiRenderer`; the prototype proved that.

Two consequences the plan must state:

- `ctx.rect` and the other shapes stay in the picture, so text is always above every shape, whatever the call order.
  Today a shape drawn after a text covers it. `shapes-draw-hud` draws its minimap after its text; the plan checks the two
  never overlap.
- The post filters no longer touch text. No game asks for filtered text; no opt-out in v1.

This changes published types (`PixiStage`, `DrawLayer`), so `api-report`, the agent skills and a patch changeset for
`@automata/framework` and `@automata/feel` follow.

### T10 (medium). A size floor moves layout

A floor in CSS px means the text is larger than its logical size on a small screen, so a box a HUD draws behind it in
logical px no longer fits (every 8 px example draws a 14 px tall box of a fixed width, 112 to 200 px). **Recommendation:** `ctx.text` returns
the box it drew, in logical px after the floor, so the box can be drawn to fit; because text is always on top (T9), the
box may be drawn after the text. The floor is multiplied by the host's scale hint (`geometry.scale`, 1.333 in Ruken's
TV mode, `packages/automata/src/shared/ui/geometry/geometry.ts:157`), the same hint the DOM's `--af-scale` follows.
Suggested floors: 12 CSS px for `ctx.text`, 14 for Feel's words (what the prototype used).

### T11 (low). One face on every device

Today's text uses Pixi's default family (Arial), which Linux and Android do not have, so the same game draws in a
different face per device. A baked font fixes that. The game's DOM keeps `system-ui` (`theme.css:26`), so a game would
show Geist on the canvas and the system face in its menus. The editors already ship Geist (`@fontsource-variable/geist`
5.3.0 in `packages/editor/package.json`). Whether the game's DOM follows is not part of this work; noted for the plan.

### T12 (low). An iPad held upright draws at 1x

`canvasResolutionFor` returns 1 for `tablet-portrait` (`canvas-resolution.ts:27`), so the crisp layer is sharp-edged
but not Retina-sharp on an iPad held upright (step 3, 2D iPad). The layer cannot draw finer than its canvas. Accepted,
not a finding to fix here.

### T13 (low). Feel's preview draws in another face

Feel's editor previews a word with the canvas 2D `fillText` (`extensions/editors/src/features/feel/FeelStage.svelte:53`)
in the page's font. Once play draws Geist, the preview should draw the same face so what a person sees in Feel is what the
player sees.

### T14 (low). What the plan must test that nothing tests today

- The edge stays sharp after a rotation or resize: the MSDF edge width is recomputed from the text's transform in
  `addRenderable` and `updateRenderable` (`AbstractBitmapTextPipe.mjs:112`), and the root's scale changes with the view.
- Words still draw after the 3D renderer's Try again builds a new app (`create-renderer.ts` `rebuild`); the font stays in
  Pixi's cache, the display objects do not.
- WebKit and Firefox draw the MSDF shader the same (the browser suites run all three).
- The cost per frame. An earlier headless run in the thread measured about 0.8 ms for one changed `Text` (resolution 8)
  and about 0.1 ms for a `BitmapText`; it ran on SwiftShader and was not repeated here, so the plan should measure with
  `tooling/frame-budget` on the GPU runner.

### T15 (low). Tests and records that move

- `packages/automata/tests/unit/app/draw/draw-layer.test.ts` and `tests/browser/app/draw/draw-layer.test.ts` (it calls
  `setup({ ui: app.stage })` and counts green pixels from `app.stage`).
- `extensions/feel/tests/unit/app/feel-stage.test.ts:234` (it reads `Text` children of `stage.ui`; its "Aïe !" case is the
  T3 fallback's first test).
- No visual golden shows canvas text: `examples/2d/__goldens__` holds replay hashes, and no test in `examples`, `site` or
  `packages/automata` uses `toHaveScreenshot`. Parity and the sim's hashes are unaffected (presentation only, law 2).
- The site's Credits page (PR #521) credits the open-source tools AF uses; Geist (OFL 1.1, Vercel with basement.studio)
  joins it, and the licence text ships with the font.

## Recommendation for the plan

1. **Core:** a `hud` layer on `PixiStage` (T9), and one text helper in core that both the draw layer and Feel use: pooled
   `BitmapText` in the baked face, linear-sampled atlas (T5), the floor (T10), the whole-string fallback (T3), and an
   optional dark shadow (T4, on for Feel's words).
2. **The font:** Geist SemiBold, MSDF, 32 px, range 4, ASCII plus Latin-1 and common marks, zero kerning dropped,
   bundled in the framework's JavaScript and loaded on the first text (T6, T7). Baked by an `automata` command, committed
   with its source sha256 and licence (T8).
3. **`ctx.text`** returns its box; the six examples draw their boxes to fit (T10).
4. **Feel:** its words on the layer with the shadow, and its editor preview in the same face (T13).
5. **Tests first:** unit (the pool, the floor, the fallback's choice), browser (sharp edges at device pixel ratio 2 and
   3, a post filter that leaves text pixels alone, rotation), and the complete-game journeys (the Feel word is sharp and
   at least the floor, measured from the played frame as in step 2, in 2D and 3D, at phone and iPad size).

## Options not taken

- **pmndrs/glyph** 0.1.0 (MIT, October 2026, pre-release): three.js `WebGPURenderer` only, a 1.36 MB text-shaping
  WebAssembly file and no GLSL; a Pixi port would be ours and would break law 6. **troika-three-text** is three.js only.
- **DOM over the canvas:** right for menus and dialogue (already DOM), wrong for per-frame HUD text and words that follow
  a character.
- **Pixi `Text` on the crisp layer at device resolution:** sharp too (the thread's comparison, option B), but about eight
  times the cost per changed string; it stays as the fallback for letters the atlas lacks (T3).

## The drunk grandma test

Today: in a new 2D game on a phone, "Ouch, a wall!" is 5.5 px letters, blocky, in the middle of the screen. She cannot
read it. With the prototype: 12 px white letters with a dark shadow over the same place. She can. Menus and dialogue are
unchanged and already pass.

## Not run or not verified

WebKit and Firefox (not installed in this container), the GPU runner, hosted CI, a real iPad or phone, Tauri, Ruken's
host, an itch zip, the 3D Try again path, and a second machine's bake. `pnpm check` was not run: this pull request adds
only this page and a section of `progress.md`.
