# EDK.3 Gesture layer and 2D viewport: TDD plan

- **Task:** EDK.3 in [02](../../02-master-delivery-plan.md). [Editor kit spec](../specs/2026-10-23-editor-kit-design.md) §4.5 (pointer pipeline, `Viewport2D`), §4.4 (the touch equivalents of undo and redo); decisions EDK-D2, EDK-D3; acceptance EK-b, EK-c (the gesture half), EK-i.
- **Lane:** editor-kit. **Depends on:** EDK.1 (the package). This PR stacks on #109 (EDK.2) so that the package index and the API report grow in one line instead of conflicting. **Unblocks:** EDK.4 (the scrubbing stepper, slider and reorderable list use the pipeline), EDK.6 (the tablet harness drives real pointers through it) and ED2D.4 (the Pixi canvas attaches it and holds a `Viewport2D`).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edk3`. The kit spec is drafted, not reviewed.
- **Progress:** 5 of 7 steps.

## Scope

**In:** `packages/editor-kit/src/gestures/` (plain TypeScript, no Svelte; EDK-D2), run in the existing `unit` project:

- A **recognizer** that turns plain pointer samples into the spec's events. It owns the rules (slop, timings, palm rejection, tap counting, pan/pinch, wheel) and takes its clock and timers as arguments, so every rule is tested with a fake clock and no DOM.
- **`attachGestures`**, the DOM adapter: Pointer Events with pointer capture, `touch-action: none`, wheel normalisation, teardown.
- **`Viewport2D`**, the pan/zoom/limits/conversion helper for the 2D canvas.
- Test helpers in `src/testing/`: `TestClock` (a fake `now` and timer set) and `FakePointer` (touch, pen, mouse sample builders).

**Out, with owner:**

| What | Where |
|---|---|
| Registering "two-finger tap = undo, three-finger tap = redo" against the history commands, and the setting that turns it off | The shell, in ED2D.4 (this task only emits `multiTap` with a finger count) |
| Real iPad Safari pointer behavior (pressure and tilt values, Pencil hover, system gestures cancelling pointers) | EDK.6 journeys on Playwright WebKit with iPad profiles, then the Orchestrator's device pass |
| Applying a `Viewport2D` to a Pixi stage, drawing the grid, hit testing | ED2D.4 |
| 3D camera control and picking | The 3D editor |
| A stepper that scrubs, a slider, a reorderable list | EDK.4 (they consume `drag` events) |

## Decisions made here (written into the kit spec in this PR)

1. **A recognizer under the adapter.** `createRecognizer(handlers, options)` takes plain samples (`{ id, kind, x, y, pressure, tiltX, tiltY, button, modifiers }`) and the `now` and timer functions, and returns `down`, `move`, `up`, `cancel`, `hover`, `wheel`, `dispose`. `attachGestures(element, handlers, options)` converts `PointerEvent`s and `WheelEvent`s into samples. Nothing but the adapter touches the DOM, so the rules do not need a browser.
2. **`tap` fires on every qualifying release with `count`** (1, 2, 3 for taps in a row within 300 ms and within slop, same pointer kind). `doubleTap` fires **in addition** when the count reaches 2. A consumer that wants only the double ignores `tap` with `count > 1`; a consumer that wants to select on tap and fit on double needs no delay. No tap is ever held back waiting for a second.
3. **Pointer-kind slop and timings** are the spec's: slop touch 8, pen 4, mouse 3 px; tap within 300 ms; long press at 450 ms inside slop; double tap gap 300 ms. All are options.
4. **Palm rejection (EK-b).** The pen is *active* while a pen pointer is down or has been seen (down, moving or hovering) within 300 ms. A touch that goes down while the pen is active is a **palm**: it makes no `tap`, `longPress`, `drag` or `multiTap`. Two palms (or a palm and a finger) still make `pan` and `pinch` **while the pen only hovers**, as the spec says; **while the pen is in contact, touches are ignored entirely**, because a pan or pinch in the middle of a stroke would fight the stroke's open transaction (a refinement of the spec's "pan/pinch only"). A pen pointer going down cancels everything touch in flight (`dragEnd` or the transform's `end` with `cancelled: true`) and turns every finger already down into an ignored palm for the rest of its life. A palm stays a palm until it lifts.
5. **Two touches are a pair, not a drag.** A second touch pointer arriving while the first is dragging ends the drag with `cancelled: true` and starts a pending pair (spec §4.5). A pair becomes `pan` and `pinch` only after its centre or its spread has travelled past the touch slop; until then it is pending. If every pointer of the pair lifts within 300 ms and nobody travelled, it is a **`multiTap`** with `fingers` 2 (or 3 when a third touch joined within the same window). So a two-finger tap undoes, and a pinch that starts never also undoes. A third touch joining a pan/pinch ends it without a `multiTap`.
6. **`pan` and `pinch` have phases** (`start`, `change`, `end`) and an `end` carries `cancelled`. Both are emitted on every change of a transforming pair: `pan` carries the centre and its delta, `pinch` the centre, the step `scale` (ratio of this spread to the last) and the `totalScale` since `start`. Rotation (step and total, radians) is reported only when `rotate: true` is passed; otherwise it is 0, so a 2D editor cannot rotate by accident.
7. **`drag` carries where it began.** `dragStart`, `drag` and `dragEnd` carry `x`, `y`, `startX`, `startY`, `dx`, `dy` (since the previous event), `pressure`, `tiltX`, `tiltY`, `pointerType`, `button`, `modifiers`; `dragEnd` adds `cancelled`; `dragStart` adds `afterLongPress` (a drag that begins after the long press fired is how a held item is moved).
8. **`pointercancel` and teardown.** A cancelled pointer ends the gesture with `cancelled: true` and never commits (EK-i part one). `dispose()` releases every captured pointer, removes every listener, clears every timer and fires **nothing**: the caller that owns an open transaction cancels it itself, so no handler runs after dispose (EK-i part two).
9. **Hover and wheel.** `hover` fires for a pen with no contact and for a mouse with no button down, never for touch. A pen hover keeps the pen active (decision 4). A `wheel` event is `{ mode: 'zoom' | 'pan', x, y, dx, dy, scale }`: Ctrl or Meta (which is what a trackpad pinch sends) zooms by `scale = 2 ** (-dy / 200)` with each delta clamped to ±100 px, anything else pans by the pixel deltas. The adapter turns line and page deltas into pixels (16 px a line, the element's height a page).
10. **`Viewport2D` is immutable.** `createViewport({ size, pan?, zoom?, limits? })` returns an object with `pan` (the screen position of world origin), `zoom` (screen pixels per world unit), `size`, `limits`, and methods that return a new viewport: `panBy`, `zoomAt(point, factor, { snap })`, `snapZoom(point)`, `fit(rect, padding)`, `resize(size)`, plus `screenToWorld` and `worldToScreen`. Zoom is clamped to `[minZoom, maxZoom]` (defaults 1/32 and 64). `snapZoom` rounds a zoom above 1 to the nearest 1/8 about a screen point, so a pinch is smooth and settles on a crisp scale at its end. `limits.bounds` (a world rect) keeps at least `limits.keep` screen pixels of it (default 64) on the screen on each axis, so the level cannot be flung out of view.

## Contract

```ts
// gestures/pointer-sample.ts
export type PointerKind = 'touch' | 'pen' | 'mouse'
export interface Modifiers { readonly shift: boolean; readonly ctrl: boolean; readonly alt: boolean; readonly meta: boolean }
export interface PointerSample {
  readonly id: number; readonly kind: PointerKind; readonly x: number; readonly y: number
  readonly pressure: number; readonly tiltX: number; readonly tiltY: number
  readonly button: number; readonly modifiers: Modifiers
}

// gestures/gesture-events.ts: TapEvent { x, y, count, pointerType }, LongPressEvent, DragEvent, PanEvent, PinchEvent,
// MultiTapEvent { x, y, fingers }, HoverEvent, WheelGesture; GestureHandlers = Partial<{ tap, doubleTap, longPress,
// dragStart, drag, dragEnd, pan, pinch, multiTap, hover, wheel }>

// gestures/recognizer.ts
export interface GestureOptions {
  slop?: Partial<Record<PointerKind, number>>; tapMs?: number; longPressMs?: number; doubleTapMs?: number
  penHoldMs?: number; rotate?: boolean
}
export interface Recognizer {
  down(sample: PointerSample): void; move(sample: PointerSample): void; up(sample: PointerSample): void
  cancel(id: number): void; hover(sample: PointerSample): void; wheel(wheel: WheelInput): void; dispose(): void
}
export function createRecognizer(handlers: GestureHandlers, options?: GestureOptions, clock?: GestureClock): Recognizer

// gestures/attach-gestures.ts
export function attachGestures(element: HTMLElement, handlers: GestureHandlers, options?: AttachOptions): () => void

// gestures/viewport-2d.ts
export function createViewport(init: ViewportInit): Viewport2D
```

## Files

Create: `src/gestures/{pointer-sample,gesture-events,recognizer,attach-gestures,viewport-2d}.ts` and a `*.test.ts` beside `recognizer`, `attach-gestures` and `viewport-2d`; `src/testing/{test-clock,fake-pointer}.ts`.
Modify: `src/index.ts`, `tooling/api-report/reports/editor-kit.api.md`, the kit spec (§4.5, §8), `docs/02-master-delivery-plan.md`, `docs/03-continuation-prompt.md`.

## Steps

Each step starts with a failing test and the reason it fails.

- [x] **1. Test helpers and the single-pointer rules.** Fails: `createRecognizer` is not exported. Tests: a release within 300 ms and slop is a `tap` with the pointer kind and `count` 1; a release after 300 ms or after travel is not; three taps in a row give counts 1, 2, 3 and `doubleTap` once, at 2; a tap by another pointer kind or far away restarts the count; a hold of 450 ms inside slop fires `longPress` once and the release is no `tap`; slop is 8 for touch, 4 for pen and 3 for mouse (travel of exactly the slop is still a tap, one pixel more is a drag).
- [x] **2. Drag.** Fails: no `dragStart`. Tests: travel past slop fires `dragStart` once, then `drag` per move with `dx`, `dy`, `startX`, `startY`, pressure, tilt, button and modifiers, then `dragEnd` with `cancelled: false` on release; the long-press timer is cancelled by the drag; a drag after a fired long press says `afterLongPress`; `cancel(id)` mid-drag fires `dragEnd` with `cancelled: true` and nothing after; a `drag` is never fired before `dragStart`; a move after the release is ignored.
- [x] **3. Palm rejection (EK-b).** Fails: a touch beside the pen is treated as a gesture. Tests: with the pen down, a touch tap, long press and drag produce nothing and the pen's drag is unaffected (the pen handler count is exact); a touch within 300 ms of a pen hover is a palm, one after 300 ms is not; a pen going down cancels a touch drag in flight (`cancelled: true`); two palms still pan and pinch; a palm is still a palm after the pen lifts, until it lifts itself.
- [x] **4. Two touches: pan, pinch, `multiTap`.** Fails: a second touch is ignored. Tests: a second touch during a drag cancels the drag and starts a pair; the pair is silent until it travels past the touch slop, then `pan` and `pinch` begin with `phase: 'start'`; moving the pair apart gives `scale` above 1 and `totalScale` their product, moving it together below 1; the centre's delta is the pan; rotation is 0 unless `rotate` is set, and then matches a quarter turn to the digit; lifting one finger ends the transform with `end` (not cancelled) and the remaining finger is inert until it lifts; a tap by two fingers inside 300 ms is `multiTap` with `fingers: 2`, with three fingers 3; a two-finger tap whose fingers moved past slop is not a `multiTap`; a third finger during pan/pinch ends it without `multiTap`; `cancel` of either pointer ends it with `cancelled: true`.
- [x] **5. Hover, wheel and teardown.** Fails: no `hover` or `wheel`. Tests: a mouse move with no button and a pen hover fire `hover`, a touch never does; Ctrl or Meta plus a wheel gives mode `zoom` with `scale` below 1 for a positive `dy`, above 1 for negative, clamped; a plain wheel gives mode `pan` with the pixel deltas; `dispose()` mid-gesture fires no handler afterwards, including timers that were due (EK-i), and a call after dispose does nothing.
- [ ] **6. The DOM adapter.** Fails: `attachGestures` is not exported. Tests, in jsdom with real `PointerEvent`s and a stubbed `setPointerCapture`: `touch-action: none` is set and restored; a pointer down captures its id and the up releases it; events from a mouse, pen and touch pointer become the same samples (modifiers from the event); `pointercancel` and `lostpointercapture` cancel; the wheel's line and page deltas become pixels and the event's default is prevented only when the handler asked for wheel; a context menu on the element is prevented; dispose releases a pointer held mid-drag, removes the listeners (a later event reaches no handler) and restores the style (EK-i).
- [ ] **7. `Viewport2D`, then docs and gates.** Fails: `createViewport` is not exported. Tests: `screenToWorld` and `worldToScreen` are inverses for random pans and zooms (property); `zoomAt` keeps the world point under the screen point fixed; zoom clamps at both limits; `snapZoom` leaves a zoom of 1 or less alone and rounds above 1 to 1/8 about the point; `fit` centres a rect with padding at the largest zoom that shows it all, within the limits; `resize` keeps the world point at the centre; the bounds limit keeps `keep` pixels of the level visible and a pan beyond it clamps; every method returns a new object and leaves the old one unchanged. Then amend kit spec §4.5 and §8, tick the rows, `pnpm api-report --update`, repo-level lint, style, knip, boundaries, the package's `typecheck` and unit suite.

## Gates

`pnpm --filter @mcthaydt/automata-editor-kit test:unit` and `typecheck`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`, `api-report`. Not run here: CI, WebKit and Firefox (the layout project is Chromium-only until EDK.6), real touch and Pencil hardware, `pnpm deps:new`, the full-repo `test:unit` (run once before the PR leaves draft).

## Execution record

(Filled in as steps pass.)
