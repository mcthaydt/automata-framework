# M4.12b: the touch stick's ring stays on screen at a compact height (plan)

> **Follow-up to** M4.12 (#204, merged; Owner approved 2026-10-30). **Spec:** M4 spec §16.3.3 (the floating move
> stick), §16.7 (A-q, A-r), M1.6 spec §3.1 (the geometry owner). **Lane:** ui. **Branch:**
> `claude/3d-m4-12b-stick-compact`.

## Problem

At 780×270 (`galaxy-chrome-landscape`, height tier `compact`) the stick's zone keeps one primary target of height
(48 px) while its ring stays 96 px across (`2 × TOUCH_STICK_RADIUS_PX`). At rest the ring is centred on the zone, so
it runs about 14 px past the bottom edge; held, it is centred where the thumb landed, so a landing near the zone's
foot or start edge draws it past the bottom and the left edge (captures `pr204-camera-drag-stick-{idle,held}-780x270.png`).

## Goal

The whole ring stays inside the usable area (the viewport less the geometry owner's insets: the safe area and Ruken's
reserved strip, and above whatever the browser lays over the page's foot) at every reference size and variant, at
rest and held, without shrinking the ring, the zone or any target, and without hiding an action. The stick still
floats: its input origin is where the thumb lands and the captured thumb may travel past the zone (TouchStick's
comment). Only where the ring is drawn is clamped.

## Interfaces

| Name | File | Consumers |
| --- | --- | --- |
| `publishedVisibleRect(root, layout)`: reads back the visible region `applyGeometry` published on the root (the `--af-inset-*` and `--af-visual-inset-bottom` properties), the one place a component reads the owner's region from | `packages/ui/src/geometry/geometry.ts` (internal, not exported from the package) | `TouchStick.svelte` |
| `clampRingCentre(centre, half, area)`: a ring centre moved the least distance that keeps a ring of half-size `half` inside `area` (centred on an axis the area is too small for) | `packages/ui/src/touch/touch-stick.ts` (internal) | `TouchStick.svelte` |

No public export changes: `api-report` should report no change.

## Files

- Create nothing outside tests. Modify `packages/ui/src/touch/TouchStick.svelte` (held ring clamped; compact rest
  ring anchored to the zone's foot), `packages/ui/src/touch/touch-stick.ts`, `packages/ui/src/geometry/geometry.ts`.
- Tests: `packages/ui/src/touch/touch.layout.test.ts` (the real-browser contract), `packages/ui/src/touch/touch-stick.test.ts`,
  `packages/ui/src/geometry/geometry.test.ts`.
- `.changeset/*.md`: a patch for `@mcthaydt/automata-ui`.

## Steps (TDD)

1. [x] Layout contract first: "the touch stick’s ring stays inside the visible area (M4.12b)" in `touch.layout.test.ts`, run
   in Chromium, WebKit and Firefox at every compact reference size (780×270, 667×320, 900×339) and 844×390, under the
   rest, host-reserved-right, host-reserved-left and tv-scale variants (the keyboard variant is left out: with the
   keyboard up the frame scrolls and a game hides its touch controls, M4 spec §8), with and without an ActionBar: the
   ring's bounding box at rest, and held with the thumb landing at each of the zone's four corners, lies inside
   `geometry.visible`. Confirm it fails at 780×270 for the reason captured (bottom edge at rest; bottom and left
   held).
2. [x] Unit tests for `clampRingCentre` and `publishedVisibleRect` (fail: not defined), then the two functions.
3. [x] The fix in `TouchStick.svelte`: held, the ring's centre is the landing point clamped by `clampRingCentre` into
   `publishedVisibleRect`, converted back to the zone's box; at a compact height the resting ring sits on the zone's
   foot (it fits the zone's width, and the zone's foot is inside the frame's padding). The vector still runs from the
   landing point, so the existing behaviour tests (`touch-stick-view.svelte.test.ts`) stay as they are.
4. [x] `pnpm --filter @mcthaydt/automata-ui test:parity` in all three browsers.
5. [x] Changeset (patch), then the gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build`,
   `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`, `pnpm changeset status --since=origin/main`,
   `node tooling/release/src/check-changesets.ts`, gitleaks. No build config changes, so no consumer smoke.
6. [x] Re-capture the two 780×270 images with the M4.12 capture method (`after-pr204-*.png`).

## Execution log

2026-10-30, this container: Node 24.21.0, pnpm 10.34.6, Playwright 1.63.0.

- **Step 1.** The contract failed in Chromium, WebKit and Firefox at all four sizes (12 of 12), for the captured
  reason: at 780×270 at rest "the ring runs 18 px past the bottom" (10 px under tv-scale, plus "2 px past the left"
  with Ruken's strip on the left, since the ring with its 2 px edge is 100 px across, wider than a 96 px zone that
  stands right at the inset); held at the zone's corners, 41 px past the left and the bottom (49 px into Ruken's
  left strip). 844×390 failed held only (the left edge).
- **Step 2.** `clampRingCentre` (3 cases) and `publishedVisibleRect` (2 cases) failed as not defined, then passed.
- **Step 3.** The fix: held, the ring is drawn at the landing point clamped into `publishedVisibleRect` (the ring's
  half-size read from its box, edge included); at rest its edge never passes the zone's start, and at a compact
  height it stands on the zone's foot. The contract passes in all three engines; the ui unit project passes
  (639 tests), the existing stick behaviour tests unchanged.
- **Step 4.** `pnpm --filter @mcthaydt/automata-ui test:parity`: 36 files, 5001 tests passed (Chromium, WebKit,
  Firefox), 482 s.
- **Step 6.** Re-captured with the M4.12 method (`capui.cjs`'s fixture page and hold) against this worktree: at
  780×270 the resting ring's box is 8,162 to 108,262 and the held ring's 0,170 to 100,270, both inside 780×270
  (before: past the bottom at rest, past the bottom and the left held). Images `after-pr204-camera-drag-stick-idle-780x270.png`
  and `after-pr204-camera-drag-stick-held-780x270.png` in the session's visual folder.
- **Decision for the Owner's veto.** The ring's drawing moves, not the stick's origin: a thumb landing near an edge
  sees the ring shifted inward and the knob off its centre until it moves, and the vector still runs from where it
  landed (moving the origin too would read the shift as a push). Held at an edge the ring may touch the usable
  area's edge (no gutter); the knob at full push may still reach past it by up to half its width.
- **Step 5.** Patch changeset `.changeset/m4-12b-stick-compact.md`. `pnpm format` clean; `TURBO_FORCE=true pnpm check`
  passed (32 of 32 tasks, none cached); `pnpm build` passed; `pnpm api-report`: 0 API breaks, 0 undeclared (no
  `BREAKING:` line); `pnpm api-index`: 555 exports, 0 undocumented; `pnpm agent-skills`: current; `pnpm changeset
  status --since=origin/main` passed once the changeset was committed (it failed before the commit, as it reads
  committed files); `check-changesets`: 12 changesets, 0 problems; gitleaks 8.30.1 over the branch's commits: no
  leaks. No build config changed, so no consumer smoke.
- **Merge of main (2026-10-30, `894c73c`).** No conflicts. `pnpm format` clean; `TURBO_FORCE=true pnpm check`: every task passed but repo-hygiene's `gitleaks.test.ts` "several installs at once" (`tar: Error is not recoverable`): it ran at the same moment as another worktree's commit hook running the same test, which failed the same way; alone, repo-hygiene 58 of 58 passed. `pnpm build`, `api-report`, `api-index`, `agent-skills` exit 0; `changeset status --since=origin/main` exit 0; `check-changesets` 19 changesets, 0 problems; ui `test:parity` 5,007 passed (36 files, Chromium, WebKit, Firefox).
