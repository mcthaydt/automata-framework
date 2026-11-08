<!--
  A small stage that plays the chosen feel: a square that gets hit, with the shake, the flash or tint, the squash and
  the word drawn from the feel runtime's own frames. It plays again after every change. What the device or the game
  cannot do (a rumble, a sound) is said in words under it.
-->
<script lang="ts">
import type { FeelContent, FeelFrame, FeelSettings } from '@automata/feel'
import { missedOutputs, STAGE_SUBJECT, type StageOutputs, stageFrames, wordText } from './feel-stage.ts'

interface Props {
  content: FeelContent | undefined
  on: string | undefined
  settings: FeelSettings
  reduced: boolean
  outputs: StageOutputs
  /** A counter that starts the stage over each time it changes. */
  replay: number
}

const { content, on, settings, reduced, outputs, replay }: Props = $props()

const FPS = 60
const SECONDS = 1.5
// The word as play draws it (spec D10): Geist semibold at the floor size, white over a black copy 1.5 CSS px down
// and right, so it reads on any colour the flash or tint puts behind it.
const WORD_FONT = '600 14px "Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const SHADOW_PX = 1.5
const SQUARE_COLOUR = '#f9c22b'
let canvas: HTMLCanvasElement | undefined = $state()
let said = $state<string[]>([])
// Set once the face is loaded: a word drawn before it would be in a stand-in and then jump.
let faceReady = $state(false)
// Bumped when the stage's box changes size, which starts the preview over at the new size.
let resized = $state(0)

$effect(() => {
  let gone = false
  const done = (): void => {
    if (!gone) faceReady = true
  }
  const loading = document.fonts?.load(WORD_FONT)
  if (loading === undefined) done()
  else loading.then(done, done)
  return () => {
    gone = true
  }
})

$effect(() => {
  if (!canvas || typeof ResizeObserver === 'undefined') return
  const watch = new ResizeObserver(() => {
    resized += 1
  })
  watch.observe(canvas)
  return () => watch.disconnect()
})

/** Backs the canvas with one pixel per device pixel of its box and returns the box in CSS px. */
function sizeBacking(target: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const box = target.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(box.width))
  const h = Math.max(1, Math.round(box.height))
  if (target.width !== Math.round(w * dpr)) target.width = Math.round(w * dpr)
  if (target.height !== Math.round(h * dpr)) target.height = Math.round(h * dpr)
  return { w, h, dpr }
}

function draw(frame: FeelFrame | undefined): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (ctx === null) return
  const { w, h, dpr } = sizeBacking(canvas)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const squash = frame?.squash.get(STAGE_SUBJECT) ?? [1, 1]
  const side = 64
  ctx.save()
  ctx.translate(w / 2 + (frame?.offset[0] ?? 0), h / 2 + (frame?.offset[1] ?? 0))
  ctx.scale(squash[0], squash[1])
  ctx.fillStyle = SQUARE_COLOUR
  ctx.fillRect(-side / 2, -side / 2, side, side)
  ctx.restore()
  for (const overlay of [frame?.tint, frame?.flash]) {
    if (overlay === null || overlay === undefined) continue
    ctx.globalAlpha = overlay.alpha
    ctx.fillStyle = overlay.colour
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
  ctx.font = WORD_FONT
  ctx.textAlign = 'center'
  for (const word of frame?.words ?? []) {
    const said = wordText(word)
    if (said === undefined) continue
    const y = h / 2 - 48 - (word.still ? 0 : word.age * 20)
    ctx.fillStyle = '#000000'
    ctx.fillText(said, w / 2 + SHADOW_PX, y + SHADOW_PX)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(said, w / 2, y)
  }
}

$effect(() => {
  // Everything the stage plays from is read here, so any of them starting it over is a change of this effect.
  const frames =
    content === undefined || on === undefined
      ? []
      : stageFrames(content, on, settings, reduced, 1 / FPS, Math.round(SECONDS * FPS))
  void replay
  void resized
  said = []
  if (!faceReady) return
  if (frames.length === 0) {
    draw(undefined)
    return
  }
  const started = performance.now()
  let reached = -1
  let handle = 0
  const step = (): void => {
    const index = Math.min(frames.length - 1, Math.floor(((performance.now() - started) / 1000) * FPS))
    for (; reached < index; reached += 1) {
      const frame = frames[reached + 1] as FeelFrame
      const missed = missedOutputs([frame], outputs)
      if (missed.length > 0) said = [...said, ...missed.filter((line) => !said.includes(line))]
    }
    draw(frames[index])
    if (index < frames.length - 1) handle = requestAnimationFrame(step)
  }
  handle = requestAnimationFrame(step)
  return () => cancelAnimationFrame(handle)
})
</script>

<figure class="stage">
  <canvas bind:this={canvas} aria-label="The feel playing"></canvas>
  <figcaption aria-live="polite">{said.join(' · ')}</figcaption>
</figure>

<style>
  .stage {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    color: var(--color-text-primary);
  }
  canvas {
    width: 100%;
    min-height: 200px;
    max-height: 40dvh;
    border-radius: var(--edge-sm);
    background: var(--color-bg-canvas);
  }
  figcaption {
    min-height: 1.5em;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
