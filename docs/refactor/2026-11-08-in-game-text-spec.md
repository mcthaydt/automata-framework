# Crisp in-game text

Status: spec, 2026-11-08. Audit: [`2026-11-08-in-game-text-audit.md`](2026-11-08-in-game-text-audit.md) (T1 to T15).
Plan: [`2026-11-08-in-game-text-plan.md`](2026-11-08-in-game-text-plan.md). Plan audit:
[`2026-11-08-in-game-text-plan-audit.md`](2026-11-08-in-game-text-plan-audit.md) (A1 to A18, fixed in place).

## 1. Why

The Owner, 2026-11-08 19:18: "we can't ship with example text looking like this". At 21:11 the Owner picked "MSDF
BitmapText on a crisp layer". Text a game draws on its canvas (`draw(ctx).text` and Feel's words) is blurry on every
screen and 5.5 px tall on a phone held upright, because it is drawn inside the fixed-size pixel picture and blown up
with it (audit T1, T2).

**Done means:** every piece of text a game draws on its canvas is sharp, at least a readable size on a phone, in the same
face on every device, the same in 2D and 3D, and never silently loses a letter, in every language AF will be translated
into.

## 2. What changes for a person

- **A player** sees Feel's words ("Bump!") and a game's HUD text as clean letters with a dark shadow, at least 14 CSS px
  (Feel) or 12 CSS px (HUD) tall on any screen. A word in Polish, Turkish, Russian or Ukrainian draws in the same face as
  English. A word in Chinese, Japanese or Korean draws, sharp, in the device's own face.
- **A person in Feel** sees the preview word in the same face as play.
- **A game author** using `ctx.text` gets back the box the text took, so a panel behind it fits; can anchor text to its
  right edge; and finds text always above shapes.
- **The drunk grandma test:** in a new 2D game on a phone, "Ouch, a wall!" is 12 px white letters with a dark shadow over
  the wall, not 5.5 px blocks. She can read it. Nothing she presses changes.

## 3. Decisions

**D1. A `hud` layer outside the picture.** `LetterboxFrame` gains `hud: Container`, added to `app.stage` after `scene`
and before `bars`. `layout` gives it the root's scale and position (so it keeps logical coordinates, and
`stage.characters.point` needs no change) and masks it with its own copy of the field mask (`hudMask`, kept in the display list on `app.stage` just before `hud`,
as the letterbox keeps `mask` inside `scene`, and redrawn in `layout` with it). Being outside
`scene`, it is outside every post filter whether the composite is on or off. Without a letterbox (no logical size), the
renderer puts `backdrop`, `world` and `ui` in a `scene` container on `app.stage`, moves the post filters onto it, and
adds `hud` after it. `PixiStage` gains `readonly hud: Container` and `hudScale(): HudScale` (D6). The 3D renderer gets
both through `createPixiRenderer`.

Consequences, stated in the API docs: text on `hud` is above every shape and sprite whatever the call order, and post
filters never touch it (no opt-out in v1).

**D2. One text helper in core.** `features/hud-text` in `@automata/framework`, public as `createHudText`. Both the draw
layer and Feel use it. It pools labels, picks a font page per string (D3), applies the floor (D6) and the shadow (D7),
and returns each label's box.

**D3. Font pages, picked per whole string.** A page is one baked MSDF font. A string draws from the first page whose
characters cover every character in it; a string no page covers draws as one Pixi `Text` (the fallback, D5). One string
never mixes faces. Before choosing, the string is normalised: U+202F and U+2009 (French typing puts a narrow no-break
space before `!`, `?`, `:` and `;`; Geist has neither) become U+00A0, and control characters (`\p{Cc}`) and invisible
format characters (`\p{Cf}`, such as the soft hyphen U+00AD, which Geist lacks) are removed. Nothing else is skipped: a
character the chosen page lacks would vanish silently (audit T3), so every character must be covered.

| Page | Characters | Languages it serves | Loaded |
| --- | --- | --- | --- |
| `latin` | ASCII; U+00A0 to U+00FF except U+00AD; Œ œ; Polish Ą ą Ć ć Ę ę Ł ł Ń ń Ś ś Ź ź Ż ż; Turkish Ğ ğ İ ı Ş ş; ‘ ’ ‚ “ ” „ ‹ › – — … • € ™ | en, es, fr, de, it, pt-BR, pl, tr | when the first `HudText` is made: Feel's at the renderer's `setup`, the draw layer's at the first `ctx.text` |
| `cyrillic` | ASCII; « » – — … • „ “ ” ‘ ’ ʼ; U+0400 to U+045F; Ґ ґ; № | ru, uk (Ukrainian writes its apostrophe as ’ or ʼ: м’яч) | on the first string that needs it |
| none | | zh-Hans, zh-Hant, ja, ko, and anything else | the fallback |

The languages are the ones the Owner queued for the editors' localization (Godot's well-supported set; the localization
thread verifies the list against Godot's Weblate and may add a page, which is a bake and a row here, no code). CJK is not
baked: thousands of glyphs per language would cost megabytes, and its words change rarely, so the fallback's cost per
changed string is acceptable there.

**D4. The font.** Geist SemiBold from `geist` 1.9.2 (OFL 1.1; it has Latin Extended, Greek and Cyrillic, no CJK:
728 code points, read from the font's `cmap`), baked with `msdf-bmfont-xml` 2.8.0 (MIT) at 32 px, distance range 4,
texture size `-m 1024,1024` with its default smart size, JSON output (the text output drops `distanceField`, T8; the
JSON writes it, `index.js:292`), zero kerning pairs dropped, one atlas per page (the baker writes `pages` as its packer's
bin count; a second bin fails the bake), with `NO_UPDATE_NOTIFIER=1` (the baker depends on `update-notifier`). The bake is repo tooling (`tooling/hud-font`, Node), run by hand with
`pnpm hud-font bake`; it writes one generated module per page into `packages/automata/src/features/hud-text/fonts/`
and a record (`fonts.record.json`: the source's sha256 and licence, each output's sha256 and byte size). `pnpm check`
verifies the committed outputs against the record and never bakes again (the baker ships per-platform binaries, so a
bake on another machine may differ). Each page is two modules: `<page>.chars.ts` (the characters, a short string, loaded
eagerly so D3 can choose without the atlas) and `<page>.font.ts` (the Pixi font data and the atlas PNG as base64,
loaded with a dynamic `import()`, so a game that draws no text never downloads it). The dynamic import is one request:
a JavaScript chunk the game's bundler writes next to the game's own, so it needs no base path and no image URL. Every
target already serves the game's chunks: itch builds use `base: './'`, the site's demos load scripts from `'self'`
(`security-headers.ts`), and its playground runtime is a Vite build whose chunks sit under `/playground/`, which answers
with CORS for the opaque frame (`site/src/features/playground/headers.ts`). The atlas never becomes an image request
(it is decoded from bytes, D8), so `img-src` is not involved (T6). Each atlas PNG
is at most 220,000 bytes (a test holds it). The OFL text ships in the published package (`licenses/geist-OFL.txt`).

**D5. The fallback.** A pooled Pixi `Text` in the game's DOM face (`--af-font` read from the document element, else
`system-ui, sans-serif`), weight 600, at `resolution` = device px per logical px (`HudScale`), updated when the scale
changes, with `textureStyle: { scaleMode: 'linear' }` (else it inherits pixel art's nearest default, `renderer.ts:145`,
and its letters tear at a fractional position). It also draws a string whose page is still loading, then the label
switches to `BitmapText` when the page arrives, so text never blinks out. In development (`import.meta.env?.DEV`, as
`boot-program.ts` writes it: the `./extension` entry also runs in Node, where `import.meta.env` is undefined), each code point that fell back for want of a
page is named once: `[automata] canvas text: "好" (U+597D) is not in the baked font; it draws in the device's face.`

**D6. A size floor in CSS px.** `HudScale` is `{ cssPerLogical, devicePerCss, hostScale }`: the root's scale, the
renderer's resolution, and the host's scale hint (`geometry.scale`, 1.333 in Ruken's TV mode). A label's size in
logical px is `max(size, floorCss * hostScale / cssPerLogical)`. Floors: 12 CSS px for `ctx.text` (`HUD_TEXT_FLOOR`),
14 for Feel's words (`WORD_TEXT_FLOOR`). The box a label returns is after the floor.

**D7. A shadow, not an outline.** Pixi's MSDF shader draws no stroke (T4). A label with `shadow: true` draws a second
copy behind it in 0x000000, offset 1.5 CSS px right and down (in logical px: `1.5 / cssPerLogical`). On for Feel's
words, off by default for `ctx.text` (`shadow` option).

**D8. The atlas samples linearly.** Pixel art sets nearest as Pixi's default (`renderer.ts:145`), which breaks an MSDF
edge (T5). The page loader creates the atlas texture source with the options Pixi's own loader gives a distance-field
font (`pixi.js/lib/scene/text-bitmap/asset/loadBitmapFont.mjs:45-50`): `scaleMode: 'linear'`,
`alphaMode: 'premultiply-alpha-on-upload'`, `autoGenerateMipmaps: false`, `resolution: 1`, explicitly, whatever the
default.

**D9. `ctx.text`.** It draws on `hud` through a `HudText` the draw layer makes on the first `ctx.text` call (a game
whose `draw` never writes text never loads a page), and returns `DrawTextBox { width, height }` in logical px.
`DrawTextOptions` gains `anchor?: { x: number; y: number }` (0 to 1, default top-left) and `shadow?: boolean`. The six
examples size their panels from the box and keep it inside the field at a phone's width (`shapes-draw-hud` anchors its
text to the right edge).

**D10. Feel.** Feel's words move to `stage.hud` through `HudText`, keep their 10 logical px, white, centred, and gain the
14 CSS px floor and the shadow (their 2 px stroke goes). The flash and tint stay in `ui` (in the picture), so a word
shows over a flash. Feel's labels are children of `hud`, so the app's teardown (`app.destroy(true, { children: true })`,
`renderer.ts`) removes them; `PixiStageHooks` has no dispose hook and gains none. A page load that resolves after the
teardown only settles a promise; a label switches kind on its next `set`, and a destroyed `hud` is never set again.

Feel's editor preview (`FeelStage.svelte`) draws its word as play does: Geist SemiBold (the editor's `Geist Variable` at
weight 600), white, with the black shadow, after `document.fonts.load`. Today the preview's canvas is 240 by 160 backing
pixels stretched to the panel's width (`width: 100%`, `min-height: 200px`), so any face is blurry there; its backing
store follows its CSS box times `devicePixelRatio`. Its field is `--color-bg-field`, which is `--paper` in the Light
theme, where a white word fails; the stage draws on a dark field in both themes (a Feel word only ever shows over a
game).

**D11. Changes to published packages.** `@automata/framework` (`PixiStage.hud`, `hudScale`, `createHudText`,
`DrawContext.text`'s return and options, `LetterboxFrame.hud`) and `@automata/feel` each get a `patch` changeset;
`pnpm build`, `pnpm api-report --update` and `pnpm api-index --write` follow, then `pnpm agent-skills` checks the agent
package. (AGENTS.md also names `pnpm agent-skills --write` and `pnpm cheatsheet`; neither exists today:
`tooling/agent-skills/src/cli.ts` only checks, the API index's `--write` writes the skill's `reference/api.md`, and the
root `package.json` has no `cheatsheet`.) The API docs say that `stage.hud` is the canvas layer, not the DOM
`hud.overlay` slot (`shared/ui/slots/ui-slot.ts`).

## 4. Out of scope

- An outline from the distance field (needs our own shader; the shadow reads well, T4).
- Post filters on text, and an opt-out from the hud.
- The game's DOM face (it keeps `system-ui`; T11 noted, not decided here).
- An iPad held upright drawing at 1x (T12, accepted).
- A content-build warning for translated Feel words that need the fallback: no game has translated Feel words yet; it
  belongs with the localization thread, which can use `choosePage` (Task 2) from Node.

## 5. How we know

- **Unit:** page choice, floor and shadow maths, the pool, the record check, the size ceiling.
- **Browser (Chromium, WebKit, Firefox):** a stem's anti-aliased edge is at most 2 device px wide at root scales 1.63
  and 4 and device pixel ratios 2 and 3; `scanlines` changes no text pixel; the mask clips at the field; a rotation
  keeps the edge and the floor; a Latin, a Cyrillic and a CJK string all draw every letter; the 3D renderer's Try again
  still draws words.
- **Journeys:** the complete-game 2D and 3D journeys, at phone and iPad size, change a Feel word, play, and measure the
  played frame: the word's white letters are at least 11 CSS px tall on the phone and their edges are crisp (the same
  measure as the browser test). Then they reload the editor, then close it and open it again on the same game, see the
  word still in Feel, play again and measure again. The published zip holds the font chunk. These are the Owner's rules:
  make a game in the editors, play it, see it; reload, close and reopen, and confirm the work persists.
- **3D gates:** the 3D browser and journey suites (`pnpm test:browser:3d`, `pnpm test:journeys:3d`, as
  `.github/workflows/3d.yml` runs them), since Feel's words draw in every new 3D game.
- **Cost:** `tooling/frame-budget` on the GPU runner with a HUD of ten changing labels; the result goes in the plan's log.
