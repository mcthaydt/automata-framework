# WEB.PLAY.11 measurements from the lane container (indicative only)

Spec §10.2 sets its budgets on the `af-mac` runner. These numbers come from the website lane's cloud container: a
shared VM with no GPU (Chromium renders WebGL in software). They are **not** the acceptance numbers; the run on
`af-mac` is still owed.

Chromium (Playwright, headless shell), `/examples/shapes-rects` at 1280×800, with the CPU throttled through CDP
`Emulation.setCPUThrottlingRate`. "Running" is the frame's `running` message (the runtime is ready and has drawn a
frame), seen as `data-run-id` changing. Each keystroke types one digit at the end of line 1 (a comment), 300 ms apart
after each run.

| Measure | CPU | Budget (§10.2) | Here |
| --- | --- | --- | --- |
| First tap on the code to an editor that takes input (cold cache) | 4× | ≤ 800 ms | 1,039 ms |
| The same | 1× | — | 384 ms |
| Last keystroke to the new run's `running`, median of 10 | 4× | ≤ 1,000 ms | 3,558 ms (3,420 to 3,784) |
| The same, desktop | 1× | ≤ 500 ms | 1,599 ms (1,477 to 1,796) |

Both keystroke rows are about three times their budgets here, including the unthrottled one, so the gap is probably
not only this machine. A fresh frame per edit has to boot the runtime. On `af-mac`, measure where the time goes before
the budgets are judged: the quiet period (300 ms), the compile, the frame's boot, or the first frame.

Lighthouse (`pnpm lighthouse`) was not run here; see the PR's gates.
