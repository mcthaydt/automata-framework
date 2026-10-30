# WEB.PLAY.6: the editor (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §6 F1 (highlighted static code),
> F2, §7.3 (the editor-load failure row), §8.1 (`CodePanel`, editor setup), §8.3 (the status texts), §9.2, §9.3,
> §10.1 (the editor chunk), §10.2 (first tap to input), §12 (dependencies), §17 WEB.PLAY.6 row.
> **Stacked on:** WEB.PLAY.5 (website#21, `claude/website-WEB.PLAY.5-examples`, head `636486c`); `framework.ref`
> `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

The first `pointerdown` or `focusin` on an example's code imports the editor chunk; CodeMirror 6 then replaces the
static code in the same box (same font, size, padding, gutter and wrapping, so nothing moves), holding the same text,
with the caret where the reader tapped and focus in the code. The editor has the accessible name "Code for <title>.
Changes update the preview.", the status line as its description, the site's focus ring, 16 px text, line wrapping,
`autocorrect`/`autocapitalize`/`spellcheck` off, the default, history and search keymaps, and no Tab binding. If the
chunk fails to load, the static code stays and the status line says so. `check:site` holds the editor chunk to at most
175 kB gzip and fails any page that preloads or loads it at arrival.

The static code gains its highlighting here (deferred from .5). It is highlighted at prerender with the same Lezer
TypeScript parser and `classHighlighter` the editor uses, so the static code and the editor share their `tok-*`
classes and the theme's colours exactly (a deviation from §9.3's "Lezer against TextMate", logged below).

Out of this task: compiling edits and the live preview (.7, so an edit changes nothing yet), diagnostics and
`@codemirror/lint` (.7), Retry (.8), Reset and the share link (.9), the determinism row (.10), the layout pass (.11).

## Interfaces

- Consumed: `Example` (`src/data/examples.ts`), `STATUS` (`status.ts`), the page's `data-code` attribute (.5 set it to
  `static`).
- Produced:
  - `highlightLines(source: string): HighlightedLine[]` in `src/lib/playground/highlight.ts`, where
    `HighlightedLine = { text: string; className: string }[]` (each line's pieces, the last carrying the newline);
    joining every piece's text gives the source byte for byte.
  - `offsetIn(root: Node, node: Node, offset: number): number | null` and `offsetAtPoint(root: HTMLElement, x, y)` in
    `src/lib/playground/caret.ts`: the source offset of a DOM position in the static code (the gutter numbers are
    CSS counters, so text nodes are the source).
  - `mountEditor(options): EditorView` in `src/lib/playground/editor.ts` (dynamic import only), options
    `{ parent, doc, label, describedBy, anchor }`.
  - `data-code`: `static` → `loading` → `ready`, or `failed`.
  - `STATUS.loadingEditor` "Loading the editor…", `STATUS.editorFailed` "The editor couldn't load. The code is shown
    read-only, and Play still runs the original." (§8.3; the apostrophe is the site's typographic one, as in
    `firstBootTimeout`).
  - `checkEditorChunk(root, pages)` in `scripts/site-checks.ts`, with `MAX_EDITOR_CHUNK_GZIP_BYTES = 175_000`.

## Files

| File | Create / modify | Responsibility |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | modify | Exact pins: `codemirror` 6.0.2, `@codemirror/lang-javascript` 6.2.4, `@codemirror/state` 6.7.6, `@codemirror/view` 6.43.15 (§12), and the versions `codemirror` 6.0.2 resolves for the packages the editor imports directly: `@codemirror/language` 6.13.1, `@codemirror/commands` 6.11.1, `@codemirror/search` 6.7.2, `@lezer/highlight` 1.2.5 |
| `src/lib/playground/highlight.ts` | create | `highlightLines` (server side, at prerender) |
| `src/lib/playground/caret.ts` | create | the tap's source offset |
| `src/lib/playground/editor.ts` | create | the CodeMirror extensions, theme, keymaps, content attributes |
| `src/lib/playground/CodePanel.svelte` | modify | highlighted static code; the upgrade on first `pointerdown`/`focusin`; the failure state |
| `src/lib/playground/Playground.svelte` | modify | `data-code`; the loading and failure status texts |
| `src/lib/playground/status.ts` | modify | the two texts |
| `src/routes/examples/[id]/+page.server.ts`, `+page.svelte` | modify | pass `highlighted` lines |
| `scripts/site-checks.ts`, `scripts/check-site.ts` | modify | `checkEditorChunk` |
| `tests/playground/highlight.test.ts`, `tests/playground/caret.test.ts` | create | unit |
| `tests/site-checks.test.ts` | modify | the editor chunk cases |
| `tests/examples-pages.test.ts` | modify | the highlighted static code keeps the exact source |
| `tests/e2e/playground.e2e.ts` | modify | real browser: the box, the caret, the accessible editor, Tab, no editor before a tap, the failure state |

## Steps (each test fails first, for the reason given)

- [ ] 1. **First failing test** (e2e, Chromium and WebKit): "the code box keeps its size when the editor replaces the
  static code". Open `/examples/shapes-rects`, measure the code box (`.code-panel`) and the code area, tap line 10,
  wait for `data-code="ready"`, measure again; equal to the pixel. Fails: `data-code` stays `static` (no editor).
- [ ] 2. Unit `highlight.test.ts`: pieces join to the source; keywords and strings carry `tok-*` classes; a file
  ending in a newline gives an empty last line, as the static box shows. Fails: no module. Then `highlight.ts`.
- [ ] 3. Unit `caret.test.ts` (jsdom): offsets across highlighted spans on several lines; a position outside the code
  gives `null`. Fails: no module. Then `caret.ts`.
- [ ] 4. DOM `examples-pages.test.ts`: the static code's text is the source byte for byte with highlighting, and its
  tokens carry `tok-*` classes. Fails: no classes. Then the loader passes `highlighted`, `CodePanel` renders it.
- [ ] 5. `editor.ts`, the upgrade in `CodePanel`, `data-code` in `Playground`, the shared theme; step 1 passes on both
  browsers.
- [ ] 6. e2e: "a tap starts editing with the caret at the tap": tap the middle of a known word on line 10; typing a
  character inserts it there (the editor's text equals the source with the character at that offset); focus is in
  `.cm-content`.
- [ ] 7. e2e: "the editor is named, described, 16 px, wraps, and Tab leaves it": accessible name, `aria-describedby`
  the status line, `autocorrect`/`autocapitalize`/`spellcheck` off, computed font size 16 px, `.cm-lineWrapping`,
  focus ring on `.cm-focused`, Tab moves focus out of `.cm-content` and Shift+Tab back.
- [ ] 8. e2e: "no editor chunk and no CodeMirror before a tap or focus", and "keyboard focus on the code loads the
  editor".
- [ ] 9. e2e: "when the editor chunk fails to load, the static code stays and the status line says so" (route the
  chunk to abort): `data-code="failed"`, the §8.3 text, the static code still there, the preview still running.
- [ ] 10. Unit `site-checks.test.ts`: a page that modulepreloads or loads the editor chunk fails; an editor chunk
  closure over 175,000 B gzip fails; a build without the editor chunk fails (the check would otherwise pass
  vacuously). Fails: no `checkEditorChunk`. Then the check, wired into `check-site.ts`.
- [ ] 11. Gates.

## Commands and expected results

- `pnpm exec vitest run tests/playground tests/examples-pages.test.ts tests/site-checks.test.ts`: all pass.
- `pnpm build && pnpm exec playwright test tests/e2e/playground.e2e.ts --project=chromium` (then `--project=webkit`):
  all pass. Run `git checkout -- src/data/first-change-proof.json` after a build.
- `pnpm check:site`: 0 failures, and it reports the editor chunk's gzip size.

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the playground spec and the example gates on
Chromium and WebKit, then the full e2e once; Lighthouse on the two example pages (the editor must not change them,
because nothing loads before a tap).

## Execution log

- 2026-10-30: plan written. Worktree `/home/user/wt/web-play-6`, branch `claude/website-WEB.PLAY.6-editor` from
  `636486c`. AF reference worktree at `f8023a9`.
- Deviation (§9.3): the static code is highlighted by the editor's own Lezer parser and `classHighlighter` at
  prerender, not by Shiki's TextMate grammar, so the two are the same colours and the swap is not even a colour
  change. Shiki stays for the site's other code blocks.
- Deviation (§12): the editor imports `@codemirror/language`, `@codemirror/commands`, `@codemirror/search` and
  `@lezer/highlight` directly (pnpm's strict layout needs them declared), pinned to the versions `codemirror` 6.0.2
  already resolves; no new code reaches the chunk. It composes those pieces instead of `basicSetup`, because
  `basicSetup`'s fold gutter, autocompletion and bracket closing would widen the gutter (a layout shift) and add
  behaviour the spec does not ask for. `@codemirror/lint` joins with the diagnostics in WEB.PLAY.7.
