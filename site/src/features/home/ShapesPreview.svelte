<!--
  What the shapes example draws, beside its code on Home: four blocks fall and wrap, a bar slides and a spinner turns,
  by the example's own rules and starting places, one step a tick at 60 ticks a second. It is a drawing of the example,
  not the framework running (that is the Examples page), so it costs Home no game bundle. It runs only while it is on
  screen, and holds one still frame when the visitor asks for less motion.
-->
<script lang="ts">
import { BAR, BLOCK, SPINNER, stateAt, TICK_MS, WORLD } from './shapes-model'

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
