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

1. [ ] Layout contract first: "the stick's ring stays inside the usable area (M4.12b)" in `touch.layout.test.ts`, run
   in Chromium, WebKit and Firefox at every compact reference size (780×270, 667×320, 900×339) and 844×390, under the
   rest, host-reserved-right, host-reserved-left and tv-scale variants (the keyboard variant is left out: with the
   keyboard up the frame scrolls and a game hides its touch controls, M4 spec §8), with and without an ActionBar: the
   ring's bounding box at rest, and held with the thumb landing at each of the zone's four corners, lies inside
   `geometry.visible`. Confirm it fails at 780×270 for the reason captured (bottom edge at rest; bottom and left
   held).
2. [ ] Unit tests for `clampRingCentre` and `publishedVisibleRect` (fail: not defined), then the two functions.
3. [ ] The fix in `TouchStick.svelte`: held, the ring's centre is the landing point clamped by `clampRingCentre` into
   `publishedVisibleRect`, converted back to the zone's box; at a compact height the resting ring sits on the zone's
   foot (it fits the zone's width, and the zone's foot is inside the frame's padding). The vector still runs from the
   landing point, so the existing behaviour tests (`touch-stick-view.svelte.test.ts`) stay as they are.
4. [ ] `pnpm --filter @mcthaydt/automata-ui test:parity` in all three browsers.
5. [ ] Changeset (patch), then the gates: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm build`,
   `pnpm api-report`, `pnpm api-index`, `pnpm agent-skills`, `pnpm changeset status --since=origin/main`,
   `node tooling/release/src/check-changesets.ts`, gitleaks. No build config changes, so no consumer smoke.
6. [ ] Re-capture the two 780×270 images with the M4.12 capture method (`after-pr204-*.png`).

## Execution log

2026-10-30, this container: Node 24.21.0, pnpm 10.34.6, Playwright 1.63.0.
