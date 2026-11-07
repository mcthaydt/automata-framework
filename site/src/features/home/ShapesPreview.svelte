<!--
  What the shapes example draws, beside its code on Home: four blocks fall and wrap, a bar slides and a spinner turns,
  by the example's own rules and starting places, one step a tick at 60 ticks a second. It is a drawing of the example,
  not the framework running (that is the Examples page), so it costs Home no game bundle. It runs only while it is on
  screen, and holds one still frame when the visitor asks for less motion.
-->
<script lang="ts">
// The example's 320 × 180 world and its views (examples/2d/shapes/shapes-rects.ts).
const WORLD = { width: 320, height: 180 }
const BLOCK = { size: 16, color: '#00cdf9' }
const BAR = { w: 64, h: 6, y: 150, color: '#5ac54f' }
const SPINNER = { x: 240, y: 70, w: 48, h: 12, color: '#f5555d' }
const TICK_MS = 1000 / 60

/** The example's state after `tick` ticks, from its setup and its `move` system. */
function stateAt(tick: number) {
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

let canvas: HTMLCanvasElement | undefined = $state()

$effect(() => {
  const element = canvas
  const context = element?.getContext('2d')
  if (element === undefined || context === undefined || context === null) return
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  let frame: number | undefined
  let start: number | undefined
  let visible = true

  function draw(tick: number): void {
    if (element === undefined || context === null || context === undefined) return
    const box = element.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    element.width = Math.round(box.width * ratio)
    element.height = Math.round(box.height * ratio)
    const scale = Math.min(box.width / WORLD.width, box.height / WORLD.height)
    const left = (box.width - WORLD.width * scale) / 2
    const top = (box.height - WORLD.height * scale) / 2
    context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * left, ratio * top)
    context.clearRect(0, 0, WORLD.width, WORLD.height)
    const { blocks, bar, angle } = stateAt(tick)
    context.fillStyle = BLOCK.color
    for (const block of blocks) context.fillRect(block.x - 8, block.y - 8, BLOCK.size, BLOCK.size)
    context.fillStyle = BAR.color
    context.fillRect(bar, BAR.y - BAR.h / 2, BAR.w, BAR.h)
    context.save()
    context.translate(SPINNER.x, SPINNER.y)
    context.rotate(angle)
    context.fillStyle = SPINNER.color
    context.fillRect(-SPINNER.w / 2, -SPINNER.h / 2, SPINNER.w, SPINNER.h)
    context.restore()
  }

  function loop(now: number): void {
    start ??= now
    draw(Math.floor((now - start) / TICK_MS))
    frame = visible ? requestAnimationFrame(loop) : undefined
  }

  if (still || typeof requestAnimationFrame === 'undefined') {
    draw(60)
    return
  }
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true
          if (visible && frame === undefined) frame = requestAnimationFrame(loop)
        })
  observer?.observe(element)
  frame = requestAnimationFrame(loop)
  return () => {
    observer?.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
  }
})
</script>

<canvas bind:this={canvas} aria-label="The shapes example: four blue blocks falling, a green bar sliding and a red bar turning"></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
