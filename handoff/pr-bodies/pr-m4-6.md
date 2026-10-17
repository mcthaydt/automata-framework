## Summary

M4.6, the remaining `ui` primitives ([plan](docs/superpowers/plans/2026-10-17-m4-6-ui-primitives.md); M4 spec §4.8, §4.12; acceptance U-a, U-b). It branches from `main`, and the first commit is the TDD plan. Split, OptionGroup, PagerDots and PagedGrid follow FloorFifty's rules and tests at `ac72660`. Button, IconButton and Toast are built to the spec's rules, because Ruken's `packages/ui` could not be read (a recorded deviation).

- **Layout:**
  - `Split` and `splitMode`;
  - `OptionGroup`, on native radios;
  - `PagerDots` and `pagerMode`, which show dots or a counter and never wrap;
  - `PagedGrid` with `paginate`, `fitShape`, `tileSide`, `trimRows`, `fitColumns`, `pageOf` and `wrapPage`.
- **Controls:**
  - `Button`: primary, secondary or ghost. A primary carries `data-kind="primary"`, so it gets 48 px.
  - `IconButton`: named by `label`. An empty label throws while it mounts.
  - `Toggle`: a checkbox with `role="switch"`, whose state shows in words.
  - `Slider`: a native range with `aria-valuetext` and a 44 px thumb.
  - The native inputs mean M4.5's pad `adjust` drives them with no code here that depends on M4.5.
- **Status:**
  - `Chip`: info, success, warning or danger. Every non-info tone shows a glyph and says its `toneLabel`.
  - `Toast`: a polite live region; an error is an alert. It never takes focus, has no timer of its own, and does not slide under reduced motion.
- **Modals:** Dialog's scoping moves to `dialog/modal-scope.ts` (`holdModal`, `inertOutside`, `isTopmost`, `wrapTab`). Dialog, `Modal` (a visible Close, and `onbackdrop` only when given) and `Sheet` (a Modal anchored to the bottom edge) share it. Dialog's DOM and layout tests pass unchanged.
- **Theme:** two Endesga tokens, `--af-success` (#5ac54f) and `--af-danger-edge` (#f5555d). `--af-danger` is only 2.26:1 against the panel, under the 3:1 an edge needs. Each new token is pinned at 3:1 against the surface and the panel.
- **U-a found two real defects, fixed in PagedGrid:**
  - With the keyboard up, the page area shrank below one row and the pager covered the first tile.
  - At TV scale, tiles were fitted at 44 px but drawn at 59 px.
  - The tile minimum now scales with `--af-scale` (as PagerDots does), and the area's floor is one tile row.
- **Viewer:** `examples/ui/primitives` has a frame for every new primitive, covered by its smoke test and E2E.
- **Deviation for Owner review:** the one-file `ui/ui-*.ts` examples move to M4.4. A one-file example cannot mount Svelte through public imports until M4.4's Settings screen renders the `settings.sections` slot. There is a follow-up row in 02.
- **Exports and docs:** the new components' header comments start with `@component`, so `pnpm api-index` passes with its baseline unchanged. `api-report` shows 0 breaks.
- **Changeset:** `ui` patch, because `check-changesets` requires patch before 1.0.

## Gates (local, `TURBO_FORCE=true`)

| Gate | Result |
|---|---|
| `pnpm format` | Clean |
| `pnpm check` | Attempt 1 failed: base-2d's typecheck reads the ui source with plain `tsc`, where a `.svelte` module has only a default export, so `ModalProps` and `PagedGridProps` could not be re-exported from the components (`TS2614`). They moved to `.ts` modules (`939bb48`). Attempt 2 passed, 30 of 30 |
| CI checks-job extras | Passed (`api-report` 0 breaks, `api-index`, cheatsheet, agent skills, `check-changesets`, build, `test:dist`) |
| `pnpm test:parity` | Passed, 11 of 11. This includes the new U-a contracts: every primitive at every reference size and variant in Chromium, WebKit and Firefox |
| `CI=1 pnpm test:e2e` | 81 passed, 2 skipped, including every new `ui-primitives` frame |
| `prepare-ruken` | Passed for Emberwick and the placeholder |

**Owner acceptance, not claimed:**
- How the new primitives look in the fixture viewer (Toggle's track, Slider's thumb, the Chip and Toast tone edges). The viewer can be opened at `examples/ui/primitives`.
- The one-file examples moving to M4.4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01QQDa25MEpciFkK7k5UV2dC
