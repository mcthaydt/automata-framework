# Crisp in-game text: build audit

Status: build audit (stage 5), 2026-11-08, of PR #540 (`claude/project-thread-bhb01n`, head `ce3c6d11`) against the
[spec](2026-11-08-in-game-text-spec.md) as corrected by the [plan audit](2026-11-08-in-game-text-plan-audit.md) (#529).
Read fresh: the builder reviewed its own work. Findings B1 to B9; fixes are stage 6.

## Verdict

The build is complete against the spec (D1 to D11 are all in the code) and it works: text a game draws is sharp and
readable in play, in 2D and 3D, at phone and iPad size, and the work survives a reload and an editor restart. Three
medium findings should be fixed before merge: text drawn with `ctx.text` disappears after a 3D "Try again" (B1), an
emoji in a Feel word shows a ghost copy of itself (B2), and a published game carries the Geist glyphs with no licence
notice (B3). The rest are low.

**Drunk grandma test:** passes. On a phone, "Ouch, a wall!" is clean white letters with a dark shadow over the wall; the
Feel preview shows the word in the same face on a dark field. She can read it and nothing she presses changed. The one
thing she would notice is B2: a doubled, smudged emoji.

## What was run (Chromium only)

| Check | Result |
| --- | --- |
| `pnpm check` | Green except `check-changesets`: `.changeset/stage-characters-3d.md` names the unpublished `@automata/3d` (base stack, known). |
| `pnpm api-report` | No break for `@automata/framework` or `@automata/feel`; it fails only on `@automata/tools` entries, unrelated. |
| `pnpm api-index` | Fails on `PROMPT_COPY` and `STICK_DIRECTIONS` (undocumented before this work, known). |
| Framework browser: `tests/browser/hud-text`, `render`, `app/draw` | 9 files, 27 tests pass. |
| 3D browser: `try-again-words.test.ts` | Pass. |
| `@automata/feel` unit | 13 files, 98 tests pass. |
| Journeys "Feel: a word is sharp and readable in play" (2D and 3D, iPad and phone) | All pass. The 3D iPad one failed once with two workers (B5) and passed twice alone. |
| Audit journey: Cyrillic, CJK and emoji words, 2D and 3D, iPad and phone | All draw, every edge 1 or 2 device px (table below). |

Not run: WebKit and Firefox (not installed in cloud sessions), the GPU runner (`pnpm test:frame-budget`, so still no
cost numbers for `hudLabels`), real devices, `pnpm test:browser:2d` and `:3d` in full (only the suites this PR touches).

## The real thing, end to end

The journeys make a new 2D game (`automata create-game`) and a new 3D game (`--template 3d`) and work them in the editors
only: Feel's word set to "Ouch, a wall!", held five seconds, played from the editor, the wall bumped and the frame
measured; then the editor page reloaded and the word still in Feel; then the editor stopped and started again on the same
folder, the word still there and served, played and measured again. All four (2D/3D x iPad/phone) pass.

A throwaway journey (`/mnt/project-files/text-rendering/build-audit/zz-audit-scripts.test.ts`, not committed) did the same
with three more words, in both kinds of game, at both sizes. Letter box height in CSS px / edge run in device px:

| Word | 2D iPad | 2D phone | 3D iPad | 3D phone |
| --- | --- | --- | --- | --- |
| Ой, стена! М’яч (Cyrillic page) | 14 / 1 | 12.5 / 2 | 29 / 1 | 15 / 2 |
| 好痛！壁だ 벽 (device face) | 16 / 1 | 14.5 / 1 | 31.5 / 1 | 17.5 / 1 |
| Ouch 😵 a wall (device face) | 12 / 1 | 10 / 1 | 22.5 / 1 | 12.5 / 1 |
| Ouch a wall (Latin page) | | 10 / 2 | | |

Every letter of every string drew, including Ukrainian’s apostrophe, Japanese kana and Korean Hangul. Frames:
`/mnt/project-files/text-rendering/build-audit/` (`*-played.png` is the whitest frame, `*-late.png` the last one).

## Findings

### Medium

**B1. `ctx.text` disappears after a 3D "Try again".** `createDrawLayer` makes its `HudText` once, on the first `text`
call, against the first stage it was set up on (`app/draw/draw-layer.ts`, `hudText ??= createHudText(stage)`), and keeps
its labels. When the 3D renderer loses its GPU context and the player presses Try again, it builds a new Pixi app and calls
`setup` again (`packages/3d/src/app/create-renderer.ts`), so the layer gets the new stage but its labels still belong to
the old, destroyed `hud`: `alive()` is false and every `text` call returns an empty box and draws nothing. A probe test
(setup, draw, destroy the hud, setup again, draw) fails: the new hud has 0 children, not 1
(`build-audit/draw-layer-second-setup.probe.ts`). Feel does not have this problem (it makes its `HudText` per setup, and
`try-again-words.test.ts` proves it). The shapes have the same root cause from before this PR (the layer's `root` is
destroyed with the old app and re-added). Fix: on a `setup` with a different stage, drop `hudText` and `labels` (and make a
fresh shapes root); test it with the probe.

**B2. An emoji in a word draws a ghost copy of itself.** A string no page covers draws as a `Text` pair; the shadow is the
same `Text` with `fill` black (`hud-label.ts`, `drawFallback`). Colour emoji ignore `fill`, so the shadow is a second
full-colour emoji 1.5 CSS px down and right, which reads as a smudged double face
(`build-audit/emoji-shadow-ghost.png`). Fix: give the fallback shadow `tint: 0x000000` (it multiplies, so any colour glyph
becomes a black silhouette) instead of, or as well as, a black fill; a browser test that the shadow of "😵" has no pixel
brighter than the field.

**B3. A published game carries the Geist glyphs without the licence.** The baked page modules name the licence only in a
`//` comment, which the game's minifier drops: bundling `latin-font.js` with Vite's minify leaves the atlas and
`af-hud-latin` but no "SIL OFL" and no copyright. OFL 1.1 asks that each copy of the font software, original or modified,
carry the copyright notice and the licence, and its FAQ treats a converted format as a modified version, so a game zip
probably counts. The framework package ships `licenses/geist-OFL.txt`; the game zip does not. Fix (cheap): make the
generated header a legal comment the minifier keeps (`/*! Geist SemiBold © 2023 Vercel, in collaboration with
basement.studio. SIL Open Font License 1.1: https://openfontlicense.org */`) and assert it in the 2D journey's zip check;
the Credits-page line (#521) is still pending as already known. Whether a game zip must also hold the full licence text
is the Owner's call.

**Fixed here, 2026-11-09** (the Owner: "Credit geist, no need for license unless you can find it"; the licence is in the
repository, so it goes in too). The credit and the full OFL now ride in each font page's data (`FONT.notice`), not a
comment: Vite 8's minifier drops even `/*!` comments in a default build, but keeps a string. Bundling `latin-font.js`
with Vite's minify now keeps "basement.studio" and "SIL Open Font License" (344,317 bytes, about 4.7 KB more). Tests:
`tooling/hud-font` checks each page's notice holds the credit and the licence text, and the 2D publish journey checks
the zip's scripts hold the copyright line (phone, passed). The bake writes the same notice. The site's Credits entry
for Geist is updated on #521's branch.

### Low

**B4. The journey's height check depends on the word.** `measureWord` takes the box of all white pixels, so a comma and an
exclamation mark add height: "Ouch, a wall!" measures 12 CSS px on the phone, "Ouch a wall" only 10, under the journey's 11.
The floor itself is right (a 14 CSS px font; capitals about 10 px tall). The spec's §2 "at least 14 CSS px tall" means the
font size, not the letters. Fix: measure a capital's height, or check the font size against the floor, and say "font size"
in the spec.

**B5. The 3D iPad word journey is slow enough to flake.** With two workers it failed once on "the game draws a word"
(20 s poll for Wick to reach the wall), then passed twice alone (1.4 min each). Give the poll more time or walk Wick closer
before the measured bump.

**B6. Page choice allocates every frame.** Each `set` normalises the string twice and `choosePage` builds a `Set` of each
page's ~230 characters per call (`missingFrom` builds the union too, for a fallback string). Ten labels at 60 fps is about
1,200 sets a second. Build each page's set once in `pages.ts`, and skip the choice when the text has not changed. The GPU
numbers that would show whether it matters were not run.

**B7. Only the 2D publish journey checks the font chunk.** The 3D publish test does not look for `af-hud-latin` in the
zip; the spec's "the published zip holds the font chunk" holds for 3D only by the shared code path.

**B8. The word harness sleeps.** `catchTheWord` waits `play.waitForTimeout(2500)` after the first white frame
(`packages/editor/tests/e2e/harness/word-pixels.ts`); AGENTS.md says browser tests wait on readiness, never on a sleep.
Poll until the whitest-frame count stops growing instead.

**B9. Small doc drift.** Spec D4 still names `<page>.chars.ts` and `<page>.font.ts` (the files are `<page>-chars.ts` and
`<page>-font.ts`, a logged build ruling). `docs/versions.md` puts the `msdf-bmfont-xml` row between `koota` and
`lefthook`, out of alphabetical order.

## Checked and fine

- Spec D1: `hud` and `hudMask` sit on `app.stage` after `scene` and before `bars`; without a letterbox, a `scene`
  container takes the post filters and `hud` follows it. A post filter leaves hud pixels alone and the mask clips at the
  field (browser tests pass).
- D3: page choice per whole string; U+202F and U+2009 become U+00A0, `\p{Cc}` and `\p{Cf}` are dropped; "Ой, стена!
  М’яч" picks `cyrillic`, "Ouch, a wall!" picks `latin`.
- D4: committed outputs match `fonts.record.json` (a unit test in `pnpm check`); atlases 179,988 and 145,020 bytes, under
  220,000; the licence is in the package's `files`. The latin chunk is 340 KB raw, 186 KB gzipped, loaded when Feel sets
  up (every new game).
- D5: fallback `Text` at device resolution, linear, re-read each `set`; the development note names each missing code point
  once.
- D6, D7, D9: floors 12 and 14 CSS px times the host scale; a 1.5 CSS px shadow; `ctx.text` returns its box and takes
  `anchor` and `shadow`; the six examples size their panels from the box.
- D8: the atlas is made with Pixi's distance-field options, linear whatever the default.
- D10: Feel's words are on `stage.hud`, 10 logical px, centred, shadowed; the editor preview draws Geist 600 white with a
  black shadow on `--color-bg-canvas` (dark in any theme), backed at the device's pixel ratio.
- D11: `patch` changesets for `@automata/framework` and `@automata/feel`; the API report, cheatsheet and agent reference
  carry the new exports.
- Layout rules: `features/hud-text` imports only itself and `shared/`; tests are in `tests/unit/hud-text`,
  `tests/browser/hud-text` and `tests/browser/render`; `pnpm boundaries` and `pnpm style` pass.

## Fixes (stage 6)

2026-11-09, branch `claude/project-thread-0c5ev3` stacked on this audit's PR (#546). Each fix has its test, written first and
seen to fail for the stated reason.

- **B1.** `createDrawLayer.setup` called with a different stage drops the layer's `HudText` and labels and makes a fresh
  shapes root, since the old app destroyed the old ones. Test: `tests/unit/app/draw/draw-layer.test.ts`, "draws text and
  shapes on the new stage after a second setup" (it failed on the destroyed `Graphics` before the text, so it covers the
  shapes the audit named as the same root cause).
- **B2.** The fallback's shadow `Text` gets `tint = 0x000000`. Test: `tests/browser/hud-text/sharp.test.ts`, the shadow of
  "😵" has no pixel brighter than the field while the emoji itself draws (it failed with 3,675 inked pixels).
- **B3.** Fixed on the build-audit branch instead (above: the credit and the full OFL ride in `FONT.notice`). This stage
  first kept a `/*!` comment, a `NOTICE` export registered with `Cache`, and a `licenses/geist-OFL.txt` that `automata ship
  prepare` copied into the build (failing when it could not find the file). When this branch met the build-audit branch's
  fix, all three were dropped: `FONT.notice` already carries the full licence into every build, and the Owner's word was
  "no need for license unless you can find it". The 2D and 3D publish journeys share `expectFontWithCredit`.
- **B4.** `measureWord` reports the first letter's height (`capitalHeightCss`), not the box of all the ink, so a comma or an
  exclamation mark no longer changes the reading. The journey's floor is 9 CSS px for a capital (a 14 CSS px font's capital
  is about 10). The spec now says the 12 and 14 CSS px floors are font sizes. Test: `tests/unit/e2e-harness/word-pixels.test.ts`.
- **B5.** The "the game draws a word" poll waits up to 45 s (was 20 s). The 3D iPad journey passed here, alone.
- **B6.** Each page's characters are made a `Set` once (a `WeakMap`), and a label keeps what its last string turned into, so
  a HUD that writes the same words each frame normalises and chooses a page once. Tests: `choose-page.test.ts` (a page's
  characters are read once) and `hud-label-cache.test.ts`. The GPU numbers that would show the gain were not run.
- **B7.** The 3D publish test asserts the same as the 2D one (`expectFontWithCredit`: the font chunk and Geist's credit). It is still marked
  `test.fail` (Publish refuses a closed-beta 3D build), so this check has not run yet.
- **B8.** `catchTheWord` polls until the whitest frame has not changed for 1.5 s instead of sleeping 2.5 s.
- **B9.** The spec names `<page>-chars.ts` and `<page>-font.ts`; `msdf-bmfont-xml` sits after `lefthook` in `docs/versions.md`.

Played end to end after the fixes (Chromium; ipad and phone): `complete-game-2d` 10 passed, with the editor page reloaded
and the editor stopped and started again on the same game folder (the Feel word still there, served, and played); the 3D
"Feel: a word" journeys 2 passed the same way. Drunk grandma test: the one thing she would have noticed, the doubled
emoji (B2), is gone; nothing else on screen changed.
