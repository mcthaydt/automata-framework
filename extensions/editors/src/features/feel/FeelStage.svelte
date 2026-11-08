<!--
  A small stage that plays the chosen feel: a square that gets hit, with the shake, the flash or tint, the squash and
  the word drawn from the feel runtime's own frames. It plays again after every change. What the device or the game
  cannot do (a rumble, a sound) is said in words under it.
-->
<script lang="ts">
import type { FeelContent, FeelFrame, FeelSettings } from '@automata/feel'
import { missedOutputs, STAGE_SUBJECT, type StageOutputs, stageFrames } from './feel-stage.ts'

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
const SIZE = { w: 240, h: 160 }
let canvas: HTMLCanvasElement | undefined = $state()
let said = $state<string[]>([])

function draw(frame: FeelFrame | undefined): void {
  const ctx = canvas?.getContext('2d')
  if (ctx === null || ctx === undefined) return
  ctx.clearRect(0, 0, SIZE.w, SIZE.h)
  const squash = frame?.squash.get(STAGE_SUBJECT) ?? [1, 1]
  const side = 64
  ctx.save()
  ctx.translate(SIZE.w / 2 + (frame?.offset[0] ?? 0), SIZE.h / 2 + (frame?.offset[1] ?? 0))
  ctx.scale(squash[0], squash[1])
  ctx.fillStyle = 'currentColor'
  ctx.fillStyle = getComputedStyle(canvas as HTMLCanvasElement).color
  ctx.fillRect(-side / 2, -side / 2, side, side)
  ctx.restore()
  for (const overlay of [frame?.tint, frame?.flash]) {
    if (overlay === null || overlay === undefined) continue
    ctx.globalAlpha = overlay.alpha
    ctx.fillStyle = overlay.colour
    ctx.fillRect(0, 0, SIZE.w, SIZE.h)
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = getComputedStyle(canvas as HTMLCanvasElement).color
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  for (const word of frame?.words ?? [])
    ctx.fillText(word.key, SIZE.w / 2, SIZE.h / 2 - 48 - (word.still ? 0 : word.age * 20))
}

$effect(() => {
  // Everything the stage plays from is read here, so any of them starting it over is a change of this effect.
  const frames =
    content === undefined || on === undefined
      ? []
      : stageFrames(content, on, settings, reduced, 1 / FPS, Math.round(SECONDS * FPS))
  void replay
  said = []
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
  <canvas bind:this={canvas} width={SIZE.w} height={SIZE.h} aria-label="The feel playing"></canvas>
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
    background: var(--color-bg-field);
    object-fit: contain;
  }
  figcaption {
    min-height: 1.5em;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
