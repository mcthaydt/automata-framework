# EDS.2b The suite's pills, Undo and the Ask diff dialog: review images

Written by `packages/editor-suite/src/shell/suite-edit.layout.test.ts` and `suite.layout.test.ts` (`pnpm --filter
@mcthaydt/automata-editor-suite test:layout`, the Chromium instance). They are for review only: nothing compares
against them. The editing images use the test's fixture editor (`src/testing/fixture-editor.ts`: one TOML file, a
"Raise speed" button), since no shipped editor mounts in the suite before EDS.2d. Its memory change set "Faster player"
already holds one write to `content/tuning.toml` (whose row names gates `g-feel` and `g-speed`) and a failing `lint`
run, as a page reloaded mid change set would find it (EDS-z); the scripted assistant proposes `MAX_MOVE_SPEED = 8`
for 640 tokens.

| Image | Size | What to look at | What changed |
|---|---|---|---|
| `suite-pills-ipad-pro-11-landscape.png` | 1194×834, `wide` | The three pills in the top bar with full labels: "Faster player", "lint failed" in red, "2 gates reopened" in amber; the checks pill open with the finding and a 44 px Locate; Undo, Redo and Ask at the bar's right; the "Locked values were cleared" toast (EDS-z) | New |
| `suite-pills-ipad-mini-landscape.png` | 1133×744, `wide` | The same at the iPad mini's height. The kit still classes 744 as tall, so the pills keep their labels here (a known follow-up: spec §12 calls this size short) | New |
| `suite-pills-ipad-pro-11-portrait.png` | 834×1194, `medium` | Full labels, with Panel and Details after the strip | New |
| `suite-pills-phone-portrait.png` | 390×844, `compact` | The pills as icons with counts (1 file, 1 failing check, 2 gates), never hidden; the open list stays inside the window; Undo, Redo and Ask scroll into view in the bar's strip (a declared scroll region) while Home, Panel and Details stay | New |
| `suite-pills-phone-landscape.png` | 844×390, `compact`, short | The icon form in the short tier, everything in one bar | New |
| `ask-diff-ipad-pro-11-landscape.png` | 1194×834 | The Ask diff dialog: the scope chip, the token meter at 640 of the cap, the summary, the unified diff with the changed line red and green, the proposal's tokens, Reject and Accept at 48 px | New |
| `ask-diff-ipad-mini-landscape.png` | 1133×744 | The same dialog at the short iPad height | New |
| `ask-diff-ipad-pro-11-portrait.png` | 834×1194 | The same dialog in portrait | New |
| `ask-diff-phone-portrait.png` | 390×844 | The dialog inside the phone's width; the long comment line scrolls sideways inside the diff (declared), the actions stay whole | New |
| `ask-diff-phone-landscape.png` | 844×390 | The dialog in the short phone height with Accept and Reject reachable | New |
| `suite-home-ipad-pro-11-landscape.png` | 1194×834, `wide` | Home over the sample game now carries the pills: "No change set", "No checks run" and "Gates not readable" (the sample ports have no gate records). The EDS.2a review's recheck: "Schematic" still fills the 56 px rail's width edge to edge; it is whole, and the rail is left as it is until the real editor labels land | Changed: the pills are new on Home; the rest is as EDS.2a's image |

The failing states (a `before` finding under its line with Accept disabled and its reason, a locked key, over budget,
the provider failing) are covered by `AskDialog.dom.test.ts`; they have no image here.
