// What the shapes example draws, as numbers: its world, its three views and where every rectangle is after `tick` ticks.
// Home's drawing (ShapesPreview.svelte) reads only this, and tests/unit/home/shapes-parity.test.ts runs the example's
// real sim headless and holds every number here to it, so the drawing cannot drift from examples/2d/shapes/shapes-rects.ts.

/** The example's 320 × 180 world (`size` in its `defineGame`). */
export const WORLD = { width: 320, height: 180 } as const
/** The example's views, one per component: size and colour, centred on the entity unless it says otherwise. */
export const BLOCK = { size: 16, color: '#52d2ff' } as const
export const BAR = { w: 64, h: 6, y: 150, color: '#7fbd39' } as const
export const SPINNER = { x: 240, y: 70, w: 48, h: 12, color: '#e45c5f' } as const
/** The sim runs 60 ticks a second. */
export const TICK_MS = 1000 / 60

/** The example's state after `tick` ticks, from its setup and its `move` system. */
export function stateAt(tick: number): {
  blocks: { x: number; y: number }[]
  bar: number
  angle: number
} {
  const blocks = [0, 1, 2, 3].map((column) => {
    // A block falls 1 a tick from `column * 40`, and from past 196 goes back to -16: it is at each of -16 to 197 in
    // turn, a cycle of 214 ticks.
    const y = ((column * 40 + 16 + tick) % 214) - 16
    return { x: 40 + column * 32, y }
  })
  // The bar slides 2 a tick from 0, and from past 320 goes back to -64: it is at each even place from -64 to 322 in
  // turn, a cycle of 194 ticks.
  const bar = ((64 + tick * 2) % 388) - 64
  return { blocks, bar, angle: tick * 0.05 }
}
