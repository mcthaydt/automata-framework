# Share after reload: the level that was gone in WebKit

The journey `packages/editor/tests/e2e/journeys/share-leaves-the-browser.test.ts` ("the level a visitor made is still
there after a reload, kept in this browser") timed out at the click after `page.reload()` in `editor-ipad-webkit` only.

## Cause: the product lost the visitor's work, and said nothing

Playwright's default WebKit context is ephemeral, like a Safari private window. There `navigator.storage.getDirectory()`
rejects with `UnknownError`; IndexedDB and `localStorage` work. A page-side probe in that context:

| call | ephemeral WebKit | persistent WebKit |
|---|---|---|
| `navigator.storage.getDirectory()` | UnknownError | ok |
| OPFS file write | UnknownError | ok |
| IndexedDB put | ok | ok |
| `localStorage` | ok | ok |

`openSuitePorts` (the sample game of the site's "Try the editor") opened `openPrivateStores`, which fails the OPFS probe,
and then dropped to a memory store, ignoring why. The level was written to memory, the reload emptied it, and the Levels
list read "No files yet." with no line saying the level was not kept. It was not a save finishing after the reload, and not
a test that reloaded too early: nothing was ever written to the browser. The hypothesis "the save finishes after the
reload" is refuted by the probe: OPFS was empty and unreadable before and after the reload.

`claude/typed-words-saved` (cd01f69dd) gives that case a "Not saved" line and a `kept` flag, but still keeps nothing, so
the journey failed there too. This branch starts from that head and keeps its `kept` flag.

## Fix

`src/shared/kit/storage/indexeddb-store.ts`: a `ProjectStore` over IndexedDB (one transaction per write, resolved when it
commits; the `expected` check and the put are in that transaction) and `openIndexedDbStore`, which probes it like the OPFS
workspace does. `open-suite-ports.ts` keeps the sample in OPFS, else IndexedDB, else memory with `kept: false` (the
"Not saved: this browser can't keep your work" line). `ProjectStore.kind` gains `'indexeddb'`.

Tests, written first: the shared `describeProjectStore` contract and two-opening ("reload") and refusal cases in real
Chromium, WebKit and Firefox (`tests/browser/storage/indexeddb-store.test.ts`); `openSuitePorts` in the WebKit private
window (`private-window.test.ts`, red before the wiring); a unit case where both stores refuse (`kept: false`).

## Evidence

| run | pass |
|---|---|
| `origin/main`, journey alone, `editor-ipad-webkit`, quiet | 0 of 6 (`editor-ipad-chromium`: 3 of 3) |
| `claude/typed-words-saved` head, same, quiet | 0 of 3 |
| old fallback restored on this branch, 6 busy loops | 0 of 5 |
| with the fix, quiet (whole file) | 3 of 3 |
| with the fix, 6 busy loops, the test alone | 20 of 20 |
| with the fix but the IndexedDB `put` removed (planted) | fails, as it must; reverted |

The loaded run on `origin/main` itself was not made: the failure is not timing, it fails 6 of 6 quiet there.

## For the tracker

- The share-after-reload failure in `editor-ipad-webkit` is a product defect, fixed on `claude/share-after-reload`
  (cause: OPFS refused in a private window, memory fallback, no message).
- Not changed, and the same defect: the 2D editor's `openWorkspace` still falls back to memory in a private window
  (`tests/browser/storage/private-window.test.ts` asserts it, "EK-f"). It could use `openIndexedDbStore` the same way;
  that contradicts a recorded contract, so it is the Owner's call.
- A private window clears IndexedDB when it closes. "Saved on this device" is true for a reload, not for closing the
  window; the line does not say so yet.
