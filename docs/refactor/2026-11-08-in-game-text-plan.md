# Crisp In-Game Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (no
> subagents in this project). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Text a game draws on its canvas (`ctx.text`, Feel's words) is sharp MSDF `BitmapText` on a `hud` layer above
the pixel picture, at a readable size, with a crisp fallback for letters the baked font lacks.

**Architecture:** A bake tool in `tooling/hud-font` writes two Geist SemiBold MSDF pages (`latin`, `cyrillic`) as
generated modules. `features/hud-text` in `@automata/framework` picks a page per string (or a device-face `Text`),
applies a CSS px floor and a shadow, and pools labels. The letterbox gains a `hud` container outside the post-filtered
scene; the draw layer and Feel draw there.

**Tech Stack:** PixiJS 8.22 (`BitmapText`, `BitmapFont`, `Text`, `Cache`), TypeScript, Vitest (unit, browser), Playwright
journeys, `msdf-bmfont-xml` 2.8.0, `geist` 1.9.2.

**Spec:** [`2026-11-08-in-game-text-spec.md`](2026-11-08-in-game-text-spec.md) (D1 to D11). Audit:
[`2026-11-08-in-game-text-audit.md`](2026-11-08-in-game-text-audit.md).

## Global Constraints

- AGENTS.md holds: test first, feature folders (a feature imports only itself and `shared/`), tests in `tests/` importing
  `#src/…`, 600 lines a file, comments say why, Conventional Commits, `pnpm format` then `pnpm check` before each commit.
- Presentation only (law 2): nothing here touches the sim; replay hashes and parity must not move.
- PixiJS only (law 6); no Effect in `@automata/framework` or `@automata/feel` (law 5). The bake tool is Node tooling.
- Floors: `HUD_TEXT_FLOOR = 12`, `WORD_TEXT_FLOOR = 14` (CSS px, times `hostScale`). Shadow: 0x000000, 1.5 CSS px right
  and down. Bake: 32 px, range 4, `-m 1024,1024`, JSON, zero kerning dropped, one atlas per page. Atlas PNG ≤ 220,000
  bytes per page.
- Page characters exactly as spec D3's table, and strings normalised before a page is chosen as D3 says (U+202F and
  U+2009 to U+00A0; `\p{Cc}` and `\p{Cf}` removed; nothing else skipped).
- The atlas always gets Pixi's distance-field texture options (D8); the fallback `Text` always
  `textureStyle: { scaleMode: 'linear' }` (D5).
- Published changes get a `patch` changeset (`@automata/framework`, `@automata/feel`); after export changes run
  `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, then `pnpm agent-skills` (a check). AGENTS.md's
  `pnpm agent-skills --write` and `pnpm cheatsheet` do not exist; do not invent them.
- The build audit makes a 2D and a 3D game in the editors, changes a Feel word, plays it at phone and iPad size, then
  reloads the editor, then closes the editor and opens it again on the same game, confirms the word is still in Feel and
  plays it again (Owner's rules, 2026-11-08 04:17 and 21:35).
- 3D runs too (Owner, 2026-11-07): `pnpm test:browser:3d` and `pnpm test:journeys:3d`.
- Copy passes the drunk grandma test. Report what ran; WebKit, Firefox and the GPU runner are left unchecked if they did
  not run.

## Review Focus

1. **Rotation or resize while text shows.** The floor, the shadow offset and the fallback's resolution follow the new
   scale on the next frame; the MSDF edge stays sharp. Test in Task 5 (browser, resize mid-run).
2. **A pooled slot switching kind.** Frame 1 draws "Bump!" (bitmap), frame 2 draws "好" in the same slot (fallback),
   frame 3 "Bump!" again: one visible object each frame, no leak. Test in Task 5.
3. **A page still loading, or the renderer disposed while it loads.** The string draws with the fallback meanwhile; a
   load that finishes after `dispose` throws nothing and adds nothing. Tests in Tasks 3 and 5.
4. **Mixed scripts and emoji.** "Привет, Ana!" draws from `cyrillic` (it holds ASCII); "Ça va ?" from `latin`;
   "Hi 👋" and "Ελα" from the fallback; an empty string draws nothing and returns a zero box. Test in Task 2.
5. **The 3D renderer's Try again.** A rebuilt app still draws Feel's words from the cached page. Test in Task 7.

---

### Task 1: Bake the font pages

**Files:**

- Create: `tooling/hud-font/package.json` (private, `@automata/hud-font`, devDependencies `msdf-bmfont-xml` 2.8.0,
  `geist` 1.9.2), `tooling/hud-font/src/pages.ts`, `tooling/hud-font/src/bake.ts`, `tooling/hud-font/src/to-pixi.ts`,
  `tooling/hud-font/src/record.ts`, `tooling/hud-font/src/cli.ts`
- Create (generated, committed): `packages/automata/src/features/hud-text/fonts/{latin,cyrillic}.chars.ts`,
  `{latin,cyrillic}.font.ts`, `fonts.record.json`; `packages/automata/licenses/geist-OFL.txt`
- Modify: root `package.json` (`"hud-font": "node tooling/hud-font/src/cli.ts"`), `packages/automata/package.json`
  (`files` gains `licenses`); `pnpm-workspace.yaml` needs nothing (it globs `tooling/*`)
- Test: `tooling/hud-font/tests/unit/to-pixi.test.ts`, `tooling/hud-font/tests/unit/record.test.ts`

**Interfaces:**

- Produces: `PAGES: readonly { id: 'latin' | 'cyrillic'; chars: string }[]` (spec D3 table, the single source the
  generated `.chars.ts` are written from); `toPixiFont(json: MsdfBmfontJson, page: string): BitmapFontData` (Pixi's
  `BitmapFontData`: `chars`, `pages`, `lineHeight`, `fontSize`, `fontFamily: 'af-hud-<page>'`, `baseLineOffset`,
  `distanceField: { type: 'msdf', range: 4 }`); `verifyRecord(root: string): string[]` (problems, empty when fine).
- Generated module shapes: `<page>.chars.ts` exports `const CHARS: string`; `<page>.font.ts` exports
  `const FONT: BitmapFontData` and `const ATLAS_PNG_BASE64: string`, with a header comment naming the bake command and the
  OFL licence.

- [x] **Step 1: Write the failing tests.** `toPixiFont` on a fixture JSON (two glyphs, a zero and a non-zero kerning
  pair, `distanceField { fieldType: 'msdf', distanceRange: 4 }`) keeps both chars, keeps only the non-zero kerning, sets
  `distanceField.type === 'msdf'` and `range === 4`; a fixture with no `distanceField` throws
  `"not an MSDF bake"`; a fixture with `common.pages: 2` throws `"more than one atlas"`. `PAGES.latin` holds no U+00AD
  and `PAGES.cyrillic` holds ’ and ʼ. `verifyRecord` on a temp copy returns `[]`, and after one byte of `latin.font.ts` changes returns
  `["latin.font.ts: sha256 does not match fonts.record.json"]`; each page's atlas size in the record is ≤ 220,000; every
  character of `PAGES` has a glyph in its page's committed `FONT.chars`.
- [x] **Step 2: Run** `pnpm --filter @automata/hud-font exec vitest run`; fail on the missing modules.
- [x] **Step 3: Implement.** `bake.ts` runs `msdf-bmfont-xml` per page (`-f json -s 32 -r 4 -t msdf -m 1024,1024`, charset
  from `PAGES` through a temporary `-i` file, `NO_UPDATE_NOTIFIER=1` in its environment) on `geist/dist/fonts/geist-sans/Geist-SemiBold.ttf`, then writes the modules and the record (source sha256,
  `licence: 'OFL-1.1'`, per output sha256 and bytes). `cli.ts`: `bake` writes, `verify` prints problems and exits 1.
- [x] **Step 4: Bake and run.** `pnpm hud-font bake`; tests pass; note each atlas's bytes and size in the plan's log
  (measured, not typed). `pnpm hud-font verify` exits 0.
- [x] **Step 5: Commit** `feat(hud-font): bake Geist SemiBold MSDF pages for canvas text`.

### Task 2: Pick a page and size a label (pure)

**Files:**

- Create: `packages/automata/src/features/hud-text/choose-page.ts`, `packages/automata/src/features/hud-text/hud-size.ts`,
  `packages/automata/src/shared/draw/hud-scale.ts`
- Test: `packages/automata/tests/unit/hud-text/choose-page.test.ts`, `packages/automata/tests/unit/hud-text/hud-size.test.ts`

**Interfaces:**

- Produces: `type PageId = 'latin' | 'cyrillic'`; `choosePage(text: string, pages: readonly { id: PageId; chars: string }[]):
  PageId | undefined`; `missingFrom(text: string, pages): string[]` (code points no page holds, for the dev note);
  `interface HudScale { cssPerLogical: number; devicePerCss: number; hostScale: number }` (in `shared/draw`);
  `HUD_TEXT_FLOOR = 12`, `WORD_TEXT_FLOOR = 14`; `hudFontSize(size: number, floorCss: number, scale: HudScale): number`;
  `shadowOffset(scale: HudScale): number` (`1.5 / cssPerLogical`).

- [x] **Step 1: Write the failing tests.** With the real `CHARS`: `choosePage('Bump!')` and `('Ça va ?')`,
  `('Zażółć gęślą jaźń')`, `('İyi şanslar')` → `'latin'`; `('Привет, Ana!')`, `('Ґанок №1')` → `'cyrillic'`;
  `('Aïe, un mur ! 好')`, `('Hi 👋')`, `('Ελα')` → `undefined` (Geist has Greek, but no page bakes it); `('')` and
  `('a\nb')` → `'latin'` (control characters ignored); `('м’яч')`, `('пʼять')` → `'cyrillic'`; `("C’est l’heure")` →
  `'latin'`. `normalise('Aïe, un mur !')` → `'Aïe, un mur !'` and it chooses `'latin'`;
  `normalise('Fuß­ball')` → `'Fußball'`. `missingFrom('Aïe 好', pages)` → `['好']`. `hudFontSize(10, 14, { cssPerLogical: 0.77,
  devicePerCss: 3, hostScale: 1 })` ≈ 18.18; at `cssPerLogical: 3.06` → 10; at `hostScale: 1.333, cssPerLogical: 1.69`
  → ≈ 11.04. `shadowOffset({ cssPerLogical: 1.5, … })` → 1.
- [x] **Step 2: Run** `pnpm --filter @automata/framework exec vitest run --project unit hud-text`; fail.
- [x] **Step 3: Implement** the functions; `normalise(text: string): string` (spec D3: U+202F and U+2009 to U+00A0,
  `\p{Cc}` and `\p{Cf}` removed), which the label draws; `choosePage` and `missingFrom` take its output and iterate code
  points (`for…of`), skipping nothing else.
- [x] **Step 4: Run**; pass.
- [x] **Step 5: Commit** `feat(framework): choose a font page and size canvas text`.

### Task 3: Load a page into Pixi

**Files:**

- Create: `packages/automata/src/features/hud-text/load-page.ts`
- Test: `packages/automata/tests/browser/hud-text/load-page.test.ts`

**Interfaces:**

- Consumes: `PageId` (Task 2); the generated `<page>.font.ts` (Task 1).
- Produces: `loadPage(id: PageId): Promise<string>` resolving to the font family (`'af-hud-latin'`) registered in Pixi's
  `Cache` under `<family>-bitmap`; memoised per id; `pageFamilyIfLoaded(id: PageId): string | undefined`.

- [x] **Step 1: Write the failing test.** After `TextureSource.defaultOptions.scaleMode = 'nearest'`, `await
  loadPage('latin')` registers `af-hud-latin-bitmap`; its page texture's `source.scaleMode === 'linear'`; two calls share
  one promise; a `BitmapText` with that family measures "Bump!" wider than 0; `pageFamilyIfLoaded('cyrillic')` is
  `undefined` until `loadPage('cyrillic')` resolves; the page source's `alphaMode` is `'premultiply-alpha-on-upload'`
  and `autoGenerateMipmaps` is false.
- [x] **Step 2: Run** `pnpm --filter @automata/framework exec vitest run --project browser hud-text/load-page`; fail.
- [x] **Step 3: Implement.** `import('./fonts/<page>.font.ts')`, decode the base64 into a `Blob`, `createImageBitmap`,
  `new TextureSource({ resource, scaleMode: 'linear', alphaMode: 'premultiply-alpha-on-upload', autoGenerateMipmaps:
  false, resolution: 1 })` (the options `loadBitmapFont.mjs:45-50` gives a distance-field font), `new BitmapFont({ data: FONT, textures: [new Texture({ source })] })`,
  `Cache.set(`${family}-bitmap`, font)` (as Pixi's own `loadBitmapFont` does in 8.22; check its file before writing).
- [x] **Step 4: Run**; pass.
- [x] **Step 5: Commit** `feat(framework): load a baked font page with a linear atlas`.

### Task 4: The `hud` layer

**Files:**

- Modify: `packages/automata/src/features/render/letterbox/letterbox.ts` (`hud`, `hudMask`, laid out in `layout`,
  destroyed in `destroy`), `packages/automata/src/features/render/renderer.ts` (add `frame.hud` after `frame.scene`;
  without a frame, a `scene` container for backdrop/world/ui carrying the post filters, `hud` after it; `stage.hud`,
  `stage.hudScale()`)
- Test: `packages/automata/tests/unit/render/letterbox/letterbox.test.ts` (extend),
  `packages/automata/tests/unit/render/renderer.test.ts` (extend), `packages/automata/tests/browser/render/hud-layer.test.ts`

**Interfaces:**

- Consumes: `HudScale` (Task 2).
- Produces: `LetterboxFrame.hud: Container`; `PixiStage.hud: Container`; `PixiStage.hudScale(): HudScale`
  (`cssPerLogical` = `frame.root.scale.x`, or 1 without a frame; `devicePerCss` = `app.renderer.resolution`;
  `hostScale` = the target geometry's current `scale`).

- [x] **Step 1: Write the failing tests.** Unit: after `layout(834, 1194)` on a 512 by 256 frame, `hud.scale.x ===
  root.scale.x`, `hud.position` equals `root.position`, `hud.mask === hudMask`, and `app.stage.children` order is
  `scene, hudMask, hud, bars`; without logical size the order is `scene, hud` and `stage.filters` sets the `scene`'s filters.
  Browser: a white `Graphics` square on `stage.hud` under a `scanlines` post filter has every pixel identical to the
  same render without the filter, while a square on `stage.ui` differs; a square on `hud` drawn past the field's bottom
  is clipped at the field.
- [x] **Step 2: Run** the unit and browser files; fail.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run**, then `pnpm --filter @automata/framework test:unit` (existing renderer, draw-layer and
  letterbox tests still pass).
- [x] **Step 5: Commit** `feat(framework): a hud layer above the pixel picture, outside the post filters`.

### Task 5: `HudText`, the labels

**Files:**

- Create: `packages/automata/src/features/hud-text/hud-label.ts`, `packages/automata/src/features/hud-text/hud-text.ts`
- Modify: `packages/automata/src/entries/render.ts` (export `createHudText`, `HudText`, `HudLabel`, `HudTextStyle`,
  `HudBox`, `HUD_TEXT_FLOOR`, `WORD_TEXT_FLOOR`, `HudScale`)
- Test: `packages/automata/tests/unit/hud-text/hud-text.test.ts`, `packages/automata/tests/browser/hud-text/sharp.test.ts`

**Interfaces:**

- Consumes: Tasks 2 to 4.
- Produces:
  - `interface HudSurface { readonly hud: Container; hudScale(): HudScale }` (structural; `PixiStage` satisfies it, so
    the feature does not import `render`).
  - `interface HudTextStyle { size: number; floor: number; color: number; shadow: boolean; anchor?: { x: number; y: number } }`
  - `interface HudBox { readonly width: number; readonly height: number }` (logical px, after the floor)
  - `interface HudLabel { set(text: string, x: number, y: number, style: HudTextStyle): HudBox; hide(): void; readonly kind: 'bitmap' | 'fallback' }`
  - `interface HudText { label(): HudLabel; destroy(): void; readonly ready: Promise<void> }` (`ready`: the latin page)
  - `createHudText(surface: HudSurface): HudText` (starts `loadPage('latin')`; each label is a `Container` on
    `surface.hud` holding a shadow child and a fill child of the same kind; switches kind when the chosen page or its
    load state changes; the fallback `Text` reads `--af-font` once, sets `resolution = devicePerCss * cssPerLogical` and
    `textureStyle: { scaleMode: 'linear' }`; the dev note per spec D5 behind `import.meta.env?.DEV`, once per code point;
    after `destroy`, or once `surface.hud.destroyed`, a late page load does nothing and `set` adds no child).

- [x] **Step 1: Write the failing tests.** Unit (fake surface, `ready` awaited): `set('Bump!', …)` gives `kind ===
  'bitmap'`, one visible fill and one shadow at `+shadowOffset`; `shadow: false` hides the shadow; anchor `{x:1,y:0}` puts
  the box's right edge at x; the box's height grows to the floor at `cssPerLogical: 0.77`; slot reuse
  `'Bump!' → '好' → 'Bump!'` gives `bitmap, fallback, bitmap` with one visible fill each time and no new children after the
  second frame; a `console.info` spy sees the "好" note once over three frames; before `ready`, `'Bump!'` is `fallback`;
  `set('')` returns `{ width: 0, height: 0 }`; `destroy` before `ready` resolves leaves `hud` with no children; a
  fallback label's texture source has `scaleMode === 'linear'` after `TextureSource.defaultOptions.scaleMode =
  'nearest'`; `set('mur !')` is `bitmap`.
  Browser (`createPixiRenderer` with pixel art, 320 by 180, views 522 by 300 and 1280 by 720, device pixel ratio 2 and
  3): "Ill" at size 8 drawn by a label: on a row through the first stem, the run of pixels with alpha between 10 % and
  90 % is at most 2 device px on each side; the same text as a `Text` on `stage.ui` gives at least 3 (proves the measure
  sees today's blur). After a resize from 1280 by 720 to 522 by 300, the next frame's box height equals the floor and the
  edge stays at most 2. "Привет" and "好" each draw non-zero pixels for every letter (columns of ink counted per glyph
  box).
- [x] **Step 2: Run** the unit and browser files; fail.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run**; pass.
- [x] **Step 5: Commit** `feat(framework): crisp canvas text labels with a fallback face`.

### Task 6: `ctx.text` on the hud, and the examples

**Files:**

- Modify: `packages/automata/src/app/draw/draw-layer.ts` (labels from a `createHudText` made on the first `text` call,
  so a `draw` that writes no text loads no page (spec D9); `setup` takes
  `Pick<PixiStage, 'ui' | 'hud' | 'hudScale'> & Partial<Pick<PixiStage, 'world'>>`; `text` returns `DrawTextBox`),
  the six examples (`render-filter`, `render-quality`, `render-interpolation`, `shapes-draw-hud`, `core-host-lifecycle`,
  `core-basic-window`)
- Test: `packages/automata/tests/unit/app/draw/draw-layer.test.ts`, `packages/automata/tests/browser/app/draw/draw-layer.test.ts`;
  `.changeset/crisp-canvas-text.md` (`@automata/framework`: patch)

**Interfaces:**

- Consumes: `createHudText`, `HUD_TEXT_FLOOR` (Task 5).
- Produces: `DrawTextOptions` gains `anchor?: { readonly x: number; readonly y: number }` and `shadow?: boolean`;
  `type DrawTextBox = HudBox`; `DrawContext.text(...): DrawTextBox`.

- [x] **Step 1: Write the failing tests.** Unit: the layer's labels are on `stage.hud`, not `ui`; `text` returns a box
  with `height ≥ 8`; unused labels hide; `watch(undefined)` hides all; a layer whose `draw` only calls `rect` adds
  nothing to `hud` and starts no page load. Browser: the existing green-pixel test reads
  from `app.stage` with `setup` given the renderer's stage. Examples: in the examples' e2e at a 393 by 659 view, each
  example's text box lies inside the field and inside its panel (the example reports both through its existing test
  hook, or the test reads the hud's bounds).
- [x] **Step 2: Run**; fail.
- [x] **Step 3: Implement.** Each example draws its text first, then its panel from the box (`x - 4`, `y - 3`,
  `box.width + 8`, `box.height + 6`); `shapes-draw-hud` anchors its text at `(ctx.width - 8, 129)` with
  `anchor: { x: 1, y: 0 }` and checks its minimap never overlaps the text's box.
- [x] **Step 4: Run** the unit, browser and `examples/2d` e2e at phone and desktop; replay hashes in
  `examples/2d/__goldens__` unchanged. Look at each example at 393 by 659 and 1280 by 720 and record the screens in
  `/mnt/project-files/text-rendering/build/`.
- [x] **Step 5:** `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, `pnpm agent-skills` (a check).
  **Commit** `feat(framework): ctx.text draws crisp on the hud and returns its box`.

### Task 7: Feel's words

**Files:**

- Modify: `extensions/feel/src/app/feel-stage.ts`
- Test: `extensions/feel/tests/unit/app/feel-stage.test.ts`; create `packages/3d/tests/browser/renderer/try-again-words.test.ts`
  (no browser test drives `rebuild` today: `tests/unit/renderer/context-loss.test.ts` covers it without pixels, and
  `tests/browser/` holds only `parity/`; check that `pnpm test:browser:3d` picks the new folder up);
  `.changeset/feel-crisp-words.md` (`@automata/feel`: patch)

**Interfaces:**

- Consumes: `createHudText`, `WORD_TEXT_FLOOR` (Task 5); `PixiStage.hud` (Task 4).
- Produces: none new; words draw as `HudLabel`s with `{ size: 10, floor: WORD_TEXT_FLOOR, color: 0xffffff, shadow:
  true, anchor: { x: 0.5, y: 1 } }`.

- [x] **Step 1: Write the failing tests.** Feel: a word's label is a child of `stage.hud` and not of `ui` (the test at
  `feel-stage.test.ts:234` moves to `hud`); the "Aïe !" case draws from `latin` with every letter; a "好" word draws as
  `fallback`; `reset` hides every word. 3D: after `rebuild`, a Feel word draws non-zero pixels on the new app.
- [x] **Step 2: Run**; fail.
- [x] **Step 3: Implement.** Replace the pooled `Text` with `HudLabel`s from one `createHudText(stage)`. The labels are
  children of `hud`, so the app's teardown destroys them; add no dispose hook to `PixiStageHooks` (spec D10).
- [x] **Step 4: Run** feel unit and `pnpm test:browser:3d`; pass. `pnpm build`, `pnpm api-report --update`,
  `pnpm api-index --write`, `pnpm agent-skills`.
- [x] **Step 5: Commit** `feat(feel): words draw crisp on the hud with a shadow and a size floor`.

### Task 8: Feel's preview in the same face

**Files:**

- Modify: `extensions/editors/src/features/feel/FeelStage.svelte`
- Test: `extensions/editors/tests/unit/feel/feel-stage-preview.test.ts`

**Interfaces:**

- Consumes: the editor's `--font-sans` (`"Geist Variable"`, `packages/editor/src/shared/kit/tokens.css:29`).

- [x] **Step 1: Write the failing test.** With a canvas 2D context spy: the word is drawn with `ctx.font` containing
  `600` and `"Geist Variable"`, once in `#000000` at `(+1.5, +1.5)` CSS px and once in white; `document.fonts.load` was
  awaited before the first draw; with `devicePixelRatio = 2` and a 320 by 200 CSS box, the canvas's backing store is 640
  by 400 and the context is scaled by 2; the stage's field is the dark game field in both the Dark and the Light theme
  (spec D10). Look at the preview in both themes at phone and desktop size and record the screens.
- [x] **Step 2: Run**; fail. **Step 3: Implement.** **Step 4: Run**; pass.
- [x] **Step 5: Commit** `feat(editors): Feel previews a word in the face play draws`.

### Task 9: Played and measured

**Files:**

- Create: `packages/editor/tests/e2e/harness/word-pixels.ts`
- Modify: `packages/editor/tests/e2e/journeys/complete-game-2d.test.ts`, `complete-game-3d.test.ts`;
  `docs/refactor/progress.md`; the plan's log below
- Test: the two journeys

**Interfaces:**

- Produces: `measureWord(png: Buffer, devicePerCss: number): { letterHeightCss: number; edgeRunDevice: number }` (the
  white letters' box and the median anti-aliased run, the same measure as Task 5).

- [x] **Step 1: Write the failing journey steps.** In both journeys, after Feel's word is set to "Ouch, a wall!" and the
  bump is played: the frame with the most white pixels (kept with `preserveDrawingBuffer`, as the audit's journey did)
  gives `letterHeightCss ≥ 11` on the phone project and `edgeRunDevice ≤ 2` on both. Then reload the editor, reopen Feel
  and see "Ouch, a wall!" still there; then stop the editor, start it again on the same game folder, reopen Feel, see
  the word, wait for the game to serve it (`servedWith`), play again and measure again (the plan audit's throwaway
  journey, `/mnt/project-files/text-rendering/plan-audit/zz-plan-audit.test.ts`, does these steps today). In the 2D
  journey's publish step, the zip holds a script with `af-hud-latin` in it.
- [x] **Step 2: Run** the new steps against #526's head in a `git worktree` (the earlier tasks are commits, not a
  stash), to see them fail for the right reason (edge and height, not the persistence steps); then on the branch:
  `playwright test -c playwright.journeys.config.ts complete-game --project editor-ipad-chromium --project
  editor-phone-chromium`; pass.
- [ ] **Step 3: Cost** (the param is built and unit-tested; the GPU numbers are not run, no runner reachable). Add a `hudLabels` parameter to the frame-budget stress page (`tooling/frame-budget/stress/params.ts`,
  drawn from `stress-screen.ts`) for ten labels changing each frame, run `pnpm test:frame-budget` on the GPU runner and
  record the numbers in the log. Add no `budget.json` row (`budget:frame` fails closed on a budgeted project with no
  hardware result). If the runner is not reachable, leave this step unchecked and say so.
- [x] **Step 4: Gates** (Chromium only; see the log). `pnpm check`, `pnpm test:unit:2d`, `pnpm test:browser:2d`, `pnpm test:browser:3d`,
  `pnpm test:journeys:3d`; record what ran and what did not (WebKit, Firefox, GPU runner).
- [x] **Step 5** (the Geist credit on the Credits page is pending: #521 is not under this branch): Update `progress.md` (build done, what ran), credit Geist (OFL 1.1, Vercel with basement.studio) on the
  site's Credits page once the site line (#521) is under this branch, else log it as pending. **Commit**
  `test(editor): the Feel word is crisp and readable in a played game`.

## Log

- 2026-11-08: plan and spec written (stage 2) on `claude/project-thread-d34lnk`, stacked on #524. Decisions beyond the
  audit: the hud is a sibling of `scene` (not a child of the root, which sits inside the post-filtered scene when the
  composite is off); fonts are split into a `latin` and a `cyrillic` page for the queued localization languages, CJK
  takes the fallback; Feel's flash stays in the picture and words show over it; `ctx.text` gains `anchor` so a HUD on a
  phone stays inside the field.
- 2026-11-08: plan audit (stage 3) on `claude/project-thread-yeb9km`, stacked on #526:
  [`2026-11-08-in-game-text-plan-audit.md`](2026-11-08-in-game-text-plan-audit.md). 18 findings (A1 to A18), all fixed
  in place in the spec and this plan. A 2D and a 3D game were made in the editors, a Feel word changed, played, the
  editor reloaded, closed and reopened, and the game played again, at iPad and phone size: the word persisted and showed
  in play in all four.
- 2026-11-08: build (stage 4) on `claude/project-thread-bhb01n`, stacked on #529. Rulings: bake files are named
  `<page>-chars.ts` and `<page>-font.ts` (the style check rejects role suffixes); `pages.ts` holds `HUD_PAGES`; the
  page source is injectable for tests; the plan's blur control was replaced by a Pixi `Text` drawn inside the picture;
  Feel's Node unit tests cover structure and the fallback path, and the bitmap path is covered by the framework's browser
  tests and the journeys; the Feel-word journeys are their own tests in `complete-game-2d` and `-3d` (the long 2D
  journey's 30-frame white flash would fill the frame the measure reads); only the light theme exists on this branch, so
  the preview screens are light (the stage field is `--color-bg-canvas`, dark in any theme). Measured (letter height CSS
  px / edge run device px), old then new: 2D phone 5.5 / 3 then 12 / 2, 2D iPad 6 / 3 then 15 / 1, 3D phone 11.5 / 6 then
  15 / 2, 3D iPad 21 / 12 then 27.5 / 2. Not run: WebKit, Firefox, the GPU runner (`pnpm test:frame-budget`), real
  devices. `AGENTS.md` names `pnpm agent-skills --write` and `pnpm cheatsheet`, which do not exist, and `pnpm api-index
  --write` fails on `PROMPT_COPY` and `STICK_DIRECTIONS` (undocumented exports from before this work). Final review: a
  self-review by the author (no subagent tool); a fresh reviewer should read it in the build audit.
- 2026-11-08: build audit (stage 5) on `claude/project-thread-93guse`, stacked on #540:
  [`2026-11-08-in-game-text-build-audit.md`](2026-11-08-in-game-text-build-audit.md). Findings B1 to B9 (3 medium: B1
  `ctx.text` after a 3D Try again, B2 the emoji shadow, B3 the licence notice in a published game). Task 9 step 3 (the GPU
  cost) is still unchecked: the GPU runner was not reachable here either.
- 2026-11-09: fixes (stage 6) on `claude/project-thread-0c5ev3`, stacked on #546: every build-audit finding, B1 to B9,
  fixed test first; see the [fix log](2026-11-08-in-game-text-build-audit.md#fixes-stage-6). Ruling: a default minify drops a `/*!`
  comment, so the notice is data; when the stage met #546's B3 fix, `FONT.notice` (credit and full OFL) won and this
  stage's `NOTICE` export and `ship prepare` licence copy were dropped. Task 9 step 3 (the GPU cost) is still unchecked: no GPU runner here.
