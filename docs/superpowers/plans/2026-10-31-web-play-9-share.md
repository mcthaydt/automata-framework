# WEB.PLAY.9: Reset, the share link and opening one (TDD plan)

> **Spec:** [live playground design](../specs/2026-10-30-live-playground-design.md) §5.6 (the share link), §5.7
> (`MAX_SHARED_SOURCE_BYTES`, `MAX_FRAGMENT_CHARS`), F7 (Reset), F8 (Share), F9 (open a share link), §8.2 (Copy code,
> Copy link, Reset), §8.3 (the could-not-be-read text), §11.4 (the privacy sentence), A-8, A-9, §17 WEB.PLAY.9 row.
> **Stacked on:** WEB.PLAY.8 (website#24, `claude/website-WEB.PLAY.8-failures`, head `ff5893a`), itself on WEB.PLAY.7
> (website#23). `framework.ref` `f8023a9`.
> **Lane:** website. Plans and specs are auto-accepted (Owner, 2026-10-30).

## Goal

- After each successful compile the address holds `#code=1.<payload>` (deflate-raw, base64url), written with
  SvelteKit's shallow `replaceState`. Nothing is stored in the browser.
- Copy link (44 px, code header, always) copies `location.href` and says "Link copied", or "Copying is blocked by this
  browser". Copy code copies the editor's current text, not the original's.
- Reset (44 px, code header) is shown only while the code differs from the original. It replaces the editor's text with
  the original in one undoable transaction (Mod-Z brings the edit back), removes the fragment, and compiles at once.
- Opening a link: after hydration a good payload loads the editor at once with the shared code and runs it through the
  worker (never the original's precompiled module; under reduced motion it waits for Play). A bad, oversized or
  over-long payload leaves the original and says "This link's code could not be read, so the original example is
  shown." The decoded text only ever goes into the editor and the frame.
- The privacy page's storage paragraph gains: the playground's preview cannot use browser storage, and an edit lives
  only in the page's address.

## Interfaces

- Produced: `src/lib/playground/share.ts`: `MAX_SHARED_SOURCE_BYTES = 65_536`, `MAX_FRAGMENT_CHARS = 32_768`,
  `encodeShare(source): Promise<string>` (the fragment without `#`, `code=1.…`), `decodeShare(hash): Promise<string |
  undefined>` (`undefined` for no `code=`; throws `ShareError` for a bad, oversized or over-long one).
- `STATUS.linkUnreadable`.
- `CodePanel` gains `reset()` (one undoable transaction), `open(doc)` (loads the editor at once with `doc`), and the
  header's Copy link and Reset; props `edited`, `onreset`, `link`.
- `CopyButton` gains optional `copied` and `blocked` texts (defaults unchanged).
- `editor.ts` gains `replaceAll(view, text)`.

## Files

| File | Create / modify | Responsibility |
| --- | --- | --- |
| `src/lib/playground/share.ts` | create | encode, decode, limits |
| `tests/playground/share.test.ts` | create | round trip, unicode, corrupted, oversized, over-long |
| `src/lib/playground/status.ts` | modify | `linkUnreadable` |
| `src/lib/playground/editor.ts` | modify | `replaceAll` |
| `src/lib/playground/CodePanel.svelte` | modify | header controls, `reset`, `open`, Copy code's text |
| `src/lib/components/CopyButton.svelte` | modify | the two texts as props |
| `src/lib/playground/Playground.svelte` | modify | the fragment, Reset, opening a link |
| `src/routes/privacy/+page.svelte` | modify | the sentence |
| `tests/e2e/playground.e2e.ts` | modify | A-8, A-9, Copy link |

## Steps (each test fails first, for the reason given)

- [x] 1. **First failing test** (e2e, Chromium): A-9's round trip. After an edit to `0xff0000` compiles, open
  `location.href` in a new browser context: the editor holds the edited code and the preview runs red. Fails: the URL
  carries nothing.
- [x] 2. Unit `share.test.ts`: round trip (ASCII and non-ASCII), the `1.` format, a corrupted payload, a payload that
  decompresses past 65,536 bytes, a fragment over 32,768 characters, an unknown format. Fails: no module. Then
  `share.ts`.
- [x] 3. `Playground` writes the fragment after each successful compile, and on mount decodes one: the shared code
  goes into the editor (`CodePanel.open`) and through the worker; the original is not fetched. Step 1 passes.
- [x] 4. e2e A-9's failures: a corrupted payload and an oversized one show the original and the could-not-be-read
  text, with no uncaught error. Fails until `Playground` handles `ShareError`.
- [x] 5. e2e A-8: Reset is absent before an edit, shown after one; pressing it makes the editor's text equal the synced
  source, removes the fragment and runs the original's code; Mod-Z brings the edit back. Fails: no Reset.
- [x] 6. e2e: Copy link (44 px) copies `location.href` with the fragment and says "Link copied"; Copy code copies the
  edited text. Fails: no Copy link.
- [x] 7. The privacy sentence (the site e2e's privacy checks and banned-phrase check still pass).
- [ ] 8. Gates.

## Commands and expected results

- `pnpm exec vitest run tests/playground`: all pass.
- `pnpm exec vite build && pnpm exec playwright test tests/e2e/playground.e2e.ts --project=chromium` (then
  `--project=webkit`): all pass. `git checkout -- src/data/first-change-proof.json` after a full `pnpm build`.

## Gates

`pnpm check` (0 errors), `pnpm test`, `pnpm build`, `pnpm check:site`, the playground spec on Chromium and WebKit, then
the full e2e once.

## Execution log

- 2026-10-31: plan written by the website lane (session_01QYLU1fqsxhm5BbLGxLS22c). Worktree `/home/user/wt/play9`,
  branch `claude/website-WEB.PLAY.9-share` from WEB.PLAY.8's head `ff5893a`.
- Step 1 failed first: the hash was `""` after the edit compiled. Step 2: `share.test.ts` failed first (no module);
  7/7 after `share.ts`. Step 3: the round trip passes.
- Deviation, steps 4–6: steps 3–6 were written in one pass, so A-9's failure cases, Reset and Copy link passed when
  their tests were first run. They don't count as having failed first. Each was checked against what it asserts:
  - Reset: the editor's text equals `examples.json`'s source byte for byte, the URL loses its fragment, run 3 starts
    and isn't red, and Mod-Z brings `0xff0000` back.
  - Copy link: the clipboard holds `page.url()`, and Copy code holds the editor's text.
- Found in review: a share link whose code can't compile (the worker fails) would leave nothing running and no Play.
  The worker's `error` now lets the original start in its place, through the usual start path (R-9). It has its own
  e2e test.
- Found while writing that test: one version reloaded the page after an earlier visit. The reloaded page lacked focus,
  and the frame's game stayed in `data-state="loading"` (`document.hasFocus()` false) until the 20 s timeout. The frame
  is the framework's, and this predates this task. Reported as a follow-up: an example opened in a background tab may
  hit it.
- Gates: `pnpm check` 0 errors, `pnpm test` 425 passed, `pnpm build`, `pnpm check:site` (editor 151,346 B, worker
  123,049 B), playground spec Chromium 34/34, WebKit 32 passed, 2 skipped (IME, clipboard).
