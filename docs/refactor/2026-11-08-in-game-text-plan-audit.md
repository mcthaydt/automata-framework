# Crisp in-game text: plan audit (stage 3)

- **Date:** 2026-11-08. **Stage:** 3 of 6 (plan audit, Opus medium), with the superpowers plugin
  (`superpowers:writing-plans`' self-review: spec coverage, step scan, type consistency, Review Focus). Native, no
  subagents.
- **Audited:** the [spec](2026-11-08-in-game-text-spec.md) and the [plan](2026-11-08-in-game-text-plan.md) at #526's head
  (`e2ca3c25`), against the checkout at that commit, Pixi 8.22.0 as installed, `geist` 1.9.2 and `msdf-bmfont-xml` 2.8.0
  as published on npm (their tarballs read, not installed), the [audit](2026-11-08-in-game-text-audit.md) (#524) and the
  Owner's rules in project memory. Every finding was checked by a command or a file read.
- **Result:** 18 findings (1 high, 8 medium, 9 low), all fixed in place in the spec and the plan. The shape stays: 11
  decisions, 9 tasks. Nothing needs the Owner.

## Findings and fixes

| # | What was wrong (evidence) | Fix (where) |
|---|---|---|
| A1 (high) | The Owner's 21:35 rule says every audit and build audit reloads **and closes and reopens** the editor and confirms the work persists. The plan's Global Constraints and Task 9 only reload, and never play again after reopening. Task 9 Step 2 also says to "stash" Tasks 4 to 7 to see the journey fail, but they are commits. | Global Constraints; Task 9 Step 1 stops the editor, starts it again on the same folder, sees the word, waits for `servedWith`, plays and measures again; Step 2 runs against #526's head in a worktree; spec §5 |
| A2 | Two commands the plan runs do not exist. `tooling/agent-skills/src/cli.ts` only checks (`--write` belongs to `pnpm api-index`, which writes the skill's `reference/api.md`), and the root `package.json` has no `cheatsheet`. AGENTS.md names both too; the plan copied it. | Spec D11; Global Constraints; Tasks 6 and 7: `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`, then `pnpm agent-skills` as a check. AGENTS.md is left alone here (not this work's to change); flagged in the PR |
| A3 | The `cyrillic` page has no apostrophe. Ukrainian writes it as ’ (U+2019) or ʼ (U+02BC) in everyday words (м’яч, п’ять, з’їв), so a Ukrainian word would leave the page for the fallback face, breaking "draws in the same face as English" for `uk`. Geist has both (its `cmap`, read with `geist-cmap.py`). | Spec D3 table (‘ ’ ʼ added); Task 1 and Task 2 tests (`м’яч`, `пʼять` → `cyrillic`) |
| A4 | "Control characters and spaces ignored" lets a character through that the page lacks, which then vanishes (the audit's T3). French typing puts a narrow no-break space (U+202F) before `!`, `?`, `:` and `;`; Geist has neither U+202F nor the thin space U+2009. "Aïe, un mur !" would pick `latin` and draw "Aïe, un mur!". | Spec D3: strings are normalised first (U+202F and U+2009 to U+00A0; `\p{Cc}` and `\p{Cf}` removed) and nothing else is skipped; Task 2 `normalise` and its tests; Task 5 test |
| A5 (low) | `latin` is "U+00A0 to U+00FF", which includes the soft hyphen U+00AD; Geist has no glyph for it (the only one of the page's 229 characters missing). Task 1's own test "every character of `PAGES` has a glyph" would fail on the first bake. | U+00AD left out of the page and removed by `normalise` (`\p{Cf}`); Task 1 test |
| A6 | Spec D4 says the font "reaches every target with no request". A dynamic `import()` is a request: a JavaScript chunk next to the game's own. It does reach every target (itch builds use `base: './'`, `games/*/vite.config.ts`; the demos allow scripts from `'self'`, `security-headers.ts:22`; the playground runtime is a Vite build under `/playground/`, which `headers.ts` answers with CORS), but nothing tested a target other than the editor's dev server. | Spec D4 says what the request is and why each target serves it; Task 9: the published 2D zip holds a script with `af-hud-latin` |
| A7 | Task 3 creates the atlas with `scaleMode: 'linear'` only. Pixi's own loader gives a distance-field font `scaleMode: 'linear'`, `alphaMode: 'premultiply-alpha-on-upload'`, `autoGenerateMipmaps: false`, `resolution: 1` (`loadBitmapFont.mjs:45-50`). Without them the atlas is uploaded differently from what Pixi's MSDF shader is written against. | Spec D8; Task 3 implementation and test |
| A8 | The fallback `Text` (CJK, emoji, a page still loading) inherits pixel art's `TextureSource.defaultOptions.scaleMode = 'nearest'` (`renderer.ts:145`), so at a fractional position its letters tear: the fallback would not be the "crisp" text the spec promises. Pixi 8.22's `Text` takes `textureStyle` (`Text.d.ts:56`). | Spec D5 (`textureStyle: { scaleMode: 'linear' }`); Global Constraints; Task 5 test |
| A9 | Task 7 extends "the Try again test file" in `packages/3d/tests/browser/…`; there is none. `rebuild` is covered only by `tests/unit/renderer/context-loss.test.ts`, without pixels, and `tests/browser/` holds only `parity/`. The gates in Task 9 list only the 2D suites, though Feel's words draw in every new 3D game and the Owner ruled 3D tests must run (2026-11-07). | Task 7 creates `packages/3d/tests/browser/renderer/try-again-words.test.ts`; Global Constraints, Task 7 Step 4 and Task 9 Step 4 run `pnpm test:browser:3d` and `pnpm test:journeys:3d`; spec §5 |
| A10 (low) | Task 7 left Feel's teardown open ("destroy it on the renderer's dispose path the stage offers, or …"). `PixiStageHooks` has `apply`, `draw` and `reset` only, so there is no path; Review Focus 3's "load after dispose" needs a decided answer. | Spec D10: the labels are children of `hud` and go with `app.destroy(true, { children: true })`; no new hook; `HudText` adds nothing once `hud.destroyed`; Tasks 5 and 7 |
| A11 (low) | D3 loads `latin` "when the first `HudText` is made (at the renderer's `setup`)", while D4 says "a game that draws no text never downloads it". A draw layer made at setup would load the page for a `draw` that only calls `rect`. | Spec D3 and D9: the draw layer makes its `HudText` on the first `ctx.text`; Task 6 test (a rect-only `draw` loads nothing) |
| A12 | Task 8 makes Feel's preview draw play's face, but the preview's canvas is 240 by 160 backing pixels stretched to the panel's width (`FeelStage.svelte`: `width: 100%`, `min-height: 200px`), so any face is blurry there. Its field is `--color-bg-field`, `--paper` in the Light theme (`tokens.css:102`), where the plan's white word would be nearly invisible. | Spec D10; Task 8: backing store by `devicePixelRatio`, a dark field in both themes, screens in both themes |
| A13 (low) | Spec D4 says Geist has "no Greek". It has Greek (728 code points; Greek and Cyrillic both in the `cmap`), just not baked. | Spec D4 wording; the "Ελα" fallback test kept, with the reason |
| A14 (low) | The dev note is gated on `import.meta.env.DEV`. The package types `env` as optional because the `./extension` entry also runs in Node (`packages/automata/src/env.d.ts`), and the code writes `import.meta.env?.DEV` (`boot-program.ts:376`). | Spec D5; Task 5 |
| A15 (low) | The bake was underspecified: no texture size (`msdf-bmfont-xml` defaults to 2048 by 2048 with smart size), and the baker writes `pages` as its packer's bin count, while each generated module holds one `ATLAS_PNG_BASE64`. The baker depends on `update-notifier`, which reaches the network on a run. Task 1 also hedged on `pnpm-workspace.yaml`, which already globs `tooling/*`. | Spec D4; Task 1 (`-m 1024,1024`, charset through `-i`, "more than one atlas" fails, `NO_UPDATE_NOTIFIER=1`; no workspace change) |
| A16 (low) | `stage.hud` (the canvas layer) and the existing DOM slot `hud.overlay` (`shared/ui/slots/ui-slot.ts:17`) share a word. A game author could read one as the other. | Spec D11: the API docs say which is which |
| A17 (low) | Task 9's cost step named no file. The frame-budget stress page is `tooling/frame-budget/stress/` (`params.ts`, `stress-screen.ts`), and `budget:frame` fails closed for a budgeted project with no hardware result, so a new `budget.json` row would turn the check red until the GPU run. | Task 9 Step 3: a `hudLabels` parameter, numbers in the log, no budget row |
| A18 (low) | `hudMask` was a mask with no place in the display list. The letterbox keeps its own `mask` inside `scene` (`letterbox.ts`) so Pixi keeps its transform; the hud's copy needs the same. | Spec D1; Task 4 test order `scene, hudMask, hud, bars` |

## What was checked and holds

- Names and places: `@automata/framework` (`packages/automata`, `entries/render.ts` re-exported by `entries/index.ts`),
  `@automata/feel` (published, in the changeset `fixed` group), `@automata/editors` (private); every test folder the plan
  extends exists (`tests/unit/render/letterbox`, `tests/unit/render/renderer.test.ts`, `tests/unit/app/draw`,
  `tests/browser/app/draw`, `extensions/editors/tests/unit/feel`); `--project unit` and `--project browser` are the
  package's Vitest projects.
- The stage: `LetterboxFrame` builds `scene` from `backdrop`, `root`, `mask` and adds `scene` then `bars` to `app.stage`
  (`renderer.ts:214-215`); the composite adopts `world` and `ui` and puts its sprite in `root`
  (`composite-target.ts`); post filters sit on the composite's stage, else `frame.scene`, else `app.stage`
  (`renderer.ts:238-252`). So D1's sibling of `scene` is outside every filter, and the no-frame case needs the new
  `scene` container the plan adds. `root.scale` is CSS px per logical px (`autoDensity: true`), and the renderer has
  `target.geometry`, whose `scale` is the host's hint (`geometry.ts:81`): `hudScale()` can be built as written.
- Pixi 8.22: `BitmapFontManager.getFont` uses the font cached at `<family>-bitmap` and calls only `ensureCharacters?.`
  (T3 holds); a family it lacks makes a dynamic canvas font, so the fallback-before-ready in Task 5 is needed;
  `new BitmapFont({ data, textures })` and `RawCharData.kerning: Record<string, number>` match Task 1 and 3.
- The baker: the JSON output writes `distanceField { fieldType, distanceRange }` (`index.js:292`); it ships `msdfgen` for
  `linux`, `linux_arm64`, `darwin`, `darwin_arm64` and `win32`, and has no install script, so pnpm's
  `onlyBuiltDependencies` does not block it.
- Geist SemiBold covers every other character of both pages (229 and 203 characters).
- The maths in Task 2: 14 / 0.77 = 18.18; 14 / 3.06 < 10; 14 × 1.333 / 1.69 = 11.04; 1.5 / 1.5 = 1.
- Feel: words are a pooled `Text` added to `stage.ui` (`feel-stage.ts`), with `stage.characters.point` in `ui`'s
  coordinates, which `hud` shares; the test at `feel-stage.test.ts:234` reads `ui`'s `Text` children; the preview draws
  at `FeelStage.svelte:53` with `14px sans-serif`; `--font-sans` is `"Geist Variable"` (`tokens.css:29`); `--af-font`
  is on `:root` (`theme.css:26`).
- The examples: six `ctx.text` users as listed; `shapes-draw-hud`'s minimap is at x 8 to 72, so a right-anchored text at
  x 312 cannot overlap it.

## Made in the editors, played, reloaded, reopened

A throwaway journey (`/mnt/project-files/text-rendering/plan-audit/zz-plan-audit.test.ts`, in the complete-game
journeys' shape, not committed) on #526's head: `pnpm install --frozen-lockfile`, `pnpm build`,
`pnpm --filter @automata/editors build`, then
`playwright test -c playwright.journeys.config.ts zz-plan-audit --project editor-ipad-chromium --project editor-phone-chromium`.
**4 passed.** For a new 2D game and a new 3D game, at iPad and phone size:

1. made with `automata create-game` and opened in the built `automata editor`;
2. in Feel, "square bumped" (2D) or "wick bumped" (3D) given the word "Ouch, a wall!" for 5000 ms; written to
   `content/feel/feel.toml` with no Save, and served by the game;
3. played from the editors (3D held sideways), Left or D held into a wall: the word showed;
4. the editor page reloaded: Feel still says "Ouch, a wall!";
5. the editor process stopped and started again on the same folder: Feel still says it, the game serves it, and played
   again the word shows again.

| Game | White pixels in the word frame, first play | After reopening |
| --- | --- | --- |
| 2D, iPad | 116 | 109 |
| 2D, phone | 123 | 123 |
| 3D, iPad | 1,692 | 1,747 |
| 3D, phone | 600 | 580 |

The frames are in `/mnt/project-files/text-rendering/plan-audit/` (`*-word.png` is the exact frame the player saw). The
word is still blurry and, in the 2D game on a phone, tiny: that is what the build fixes; this run proves only that the
work persists and reaches play today, so Task 9's new steps start from a journey that passes its persistence half.

## The drunk grandma test

The plan's player-facing promise passes: in a new 2D game on a phone, "Ouch, a wall!" becomes readable white letters
with a dark shadow. Two places it would have failed and now does not: a Ukrainian word that silently changed face (A3),
and a French word that lost its space before the "!" (A4). In the editor, the Feel preview would have shown a white word
on light paper in the Light theme (A12); it now draws on the game's dark field. The developer note ("is not in the baked
font; it draws in the device's face") is for a game author in the console, not for a player.

## Not run or not verified

WebKit and Firefox (not installed here), the GPU runner, hosted CI, real devices, Tauri, Ruken, an itch zip played from
a sub-path, the site's playground with a text example, and a bake (the baker's dependencies were not installed in this
container; its source was read). `pnpm check` was not run: this pull request changes only documents.
