// Touch for browser journeys: tap, hold, swipe and flick, as a finger's pointer events
// (`pointerType: 'touch'`). They are dispatched in the target's own frame, so they work under the fake Ruken host
// and in every engine; WebKit has no CDP to synthesize real touches. Taps on ordinary controls can use Playwright's
// own `locator.tap()`; these are for what holds or moves: the touch buttons and gesture surfaces.
// Every helper waits on animation frames or the caller's condition, never a sleep.
import type { Frame, Locator, Page } from '@playwright/test'

/** A point in the target frame's own CSS pixels. */
export interface Point {
  readonly x: number
  readonly y: number
}

/** One finger's id, so a button's capture bookkeeping sees a single finger from down to up. */
const FINGER = 42

/** A finger down on `target`'s centre and straight up again. */
export async function tap(target: Locator): Promise<void> {
  await hold(target, async () => true)
}

/** A finger down on `target`'s centre until `until` resolves true (checked once a frame), then up. */
export async function hold(target: Locator, until: () => Promise<boolean>): Promise<void> {
  await finger(target, 'pointerdown')
  try {
    while (!(await until()))
      await target.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  } finally {
    await finger(target, 'pointerup')
  }
}

/** A finger from `from` to `to` over `ms` milliseconds, one move a frame, on whatever is under it. */
export async function swipe(scope: Page | Frame, from: Point, to: Point, ms: number): Promise<void> {
  await scope.evaluate(
    ({ from, to, ms, id }) =>
      new Promise<void>((resolve) => {
        const send = (type: string, point: { x: number; y: number }) =>
          (document.elementFromPoint(point.x, point.y) ?? document.body).dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              pointerId: id,
              pointerType: 'touch',
              isPrimary: true,
              clientX: point.x,
              clientY: point.y,
            }),
          )
        const start = performance.now()
        send('pointerdown', from)
        const step = (): void => {
          const t = Math.min(1, (performance.now() - start) / ms)
          const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
          send('pointermove', point)
          if (t < 1) requestAnimationFrame(step)
          else {
            send('pointerup', point)
            resolve()
          }
        }
        requestAnimationFrame(step)
      }),
    { from, to, ms, id: FINGER },
  )
}

/** A quick vertical swipe of `dy` pixels within `ms` milliseconds from `from` (the gesture tests use 40 px in 180 ms). */
export async function flick(scope: Page | Frame, from: Point, dy: number, ms: number): Promise<void> {
  await swipe(scope, from, { x: from.x, y: from.y + dy }, ms)
}

async function finger(target: Locator, type: 'pointerdown' | 'pointerup'): Promise<void> {
  await target.evaluate(
    (element, { type, id }) => {
      const box = element.getBoundingClientRect()
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: id,
          pointerType: 'touch',
          isPrimary: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
        }),
      )
    },
    { type, id: FINGER },
  )
}
