<!--
  The Studio's stage (EDS.9a to EDS.9c; editor suite spec §6.2, EDS-D13): the figure drawn by the game's own figure view
  on a WebGL2 canvas, and over it the mode switch and, in Pose, the handles. Look: a drag sideways turns the figure.
  Pose and Animate: a drag turns the camera about it. A pinch or the wheel zooms. A handle drags in the plane facing the
  camera (`stage-camera`'s maths), shows live, and is one step when it is let go; the arrow keys move a focused handle by
  2 cm. Animate plays the clip through the playhead on the frame clock. Without WebGL2, or after the context is lost, the
  stage says so and offers Try again; the fields keep working (EDS spec §11).
-->
<script lang="ts">
import { attachGestures, Button, Segmented } from '@mcthaydt/automata-editor-kit'
import { untrack } from 'svelte'
import { dragPlane, orbit, pickRay, project, rayAtPlane, turned, type Vec3 } from '../stage/stage-camera'
import type { StageRenderer, StageRendererFactory } from '../stage/stage-renderer'
import type { StudioController } from '../studio-controller'
import { handlesOf, type StudioMode, stageOf } from '../studio-view'

/** The frame clock, so a test plays a clip by hand. */
export interface Frames {
  request(callback: (seconds: number) => void): number
  cancel(handle: number): void
}

interface Props {
  controller: StudioController
  stage: StageRendererFactory
  frames: Frames
  background: number
}

const { controller, stage, frames, background }: Props = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const viewState = controller.view.state
const content = $derived.by(() => {
  void $revision
  return controller.content()
})

let host = $state<HTMLElement>()
let canvas = $state<HTMLCanvasElement>()
let size = $state({ w: 0, h: 0, resolution: 1 })
let renderer = $state.raw<StageRenderer | undefined>()
let status = $state<'loading' | 'ready' | 'unavailable' | 'paused'>('loading')
let attempt = $state(0)

const modes = [
  { id: 'look', label: 'Look' },
  { id: 'pose', label: 'Pose' },
  { id: 'animate', label: 'Animate' },
]

// The size follows the host; before the first measure the stage waits.
$effect(() => {
  const element = host
  if (element === undefined) return
  const measure = (w: number, h: number): void => {
    size = {
      w: Math.max(1, Math.round(w)),
      h: Math.max(1, Math.round(h)),
      resolution: window.devicePixelRatio || 1,
    }
  }
  const box = element.getBoundingClientRect()
  measure(box.width, box.height)
  const watch = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect !== undefined) measure(rect.width, rect.height)
  })
  watch.observe(element)
  return () => watch.disconnect()
})

// The renderer is made once the canvas has a size, and again on Try again; a resize is the next effect's, never a new renderer.
const sized = $derived(size.w >= 2 && size.h >= 2)
$effect(() => {
  void attempt
  const target = canvas
  if (target === undefined || !sized) return
  let current: StageRenderer | undefined
  let gone = false
  status = 'loading'
  const first = untrack(() => size)
  void stage(target, first, background).then((made) => {
    if (gone) {
      made?.destroy()
      return
    }
    if (made === undefined) {
      status = 'unavailable'
      return
    }
    current = made
    renderer = made
    status = 'ready'
    made.paused.subscribe((paused) => {
      if (status !== 'unavailable') status = paused ? 'paused' : 'ready'
    })
  })
  return () => {
    gone = true
    renderer = undefined
    current?.destroy()
  }
})

$effect(() => {
  if (renderer === undefined || size.w < 2) return
  renderer.resize(size)
})

// What is drawn: the figure when its content changes, then the pose, the facing and the camera, every time.
let shown: { def: unknown; library: unknown; motion: unknown } | undefined
$effect(() => {
  const draw = renderer
  if (draw === undefined || size.w < 2) return
  const now = stageOf(content, $viewState)
  if (shown?.def !== now.def || shown?.library !== now.library || shown?.motion !== now.motion) {
    shown = { def: now.def, library: now.library, motion: now.motion }
    draw.show(now.def, now.library, now.motion)
  }
  draw.face(now.facing)
  draw.look($viewState.orbit)
  draw.pose(now.state, now.time)
})

// Playing a clip steps the playhead on the frame clock; a clip that ends stops, or goes round.
$effect(() => {
  if (!$viewState.playing || $viewState.mode !== 'animate') return
  const length = content.clips.find((entry) => entry.id === $viewState.clip)?.value?.length ?? 0
  const loop = content.clips.find((entry) => entry.id === $viewState.clip)?.value?.loop ?? 'once'
  let last: number | undefined
  let handle = 0
  const step = (seconds: number): void => {
    const dt = last === undefined ? 0 : seconds - last
    last = seconds
    const next = controller.view.current.playhead + dt
    if (next >= length) {
      if (loop === 'loop' || loop === 'pingpong') controller.view.setPlayhead(next - length)
      else {
        controller.view.setPlayhead(length)
        controller.view.setPlaying(false)
        return
      }
    } else controller.view.setPlayhead(next)
    handle = frames.request(step)
  }
  handle = frames.request(step)
  return () => frames.cancel(handle)
})

// Gestures on the stage: turn, orbit, zoom.
$effect(() => {
  const element = host
  if (element === undefined) return
  return attachGestures(element, {
    drag(event) {
      const view = controller.view.current
      if (view.mode === 'look') controller.view.setFacing(turned(view.facing, event.dx, Math.max(1, size.w)))
      else controller.view.setOrbit(orbit(view.orbit, { dx: event.dx, dy: event.dy }))
    },
    pinch(event) {
      const view = controller.view.current
      controller.view.setOrbit({
        ...view.orbit,
        distance: Math.min(8, Math.max(1.2, view.orbit.distance / event.scale)),
      })
    },
    wheel(event) {
      const view = controller.view.current
      if (event.mode === 'zoom')
        controller.view.setOrbit({
          ...view.orbit,
          distance: Math.min(8, Math.max(1.2, view.orbit.distance / event.scale)),
        })
    },
  })
})

// --- handles ----------------------------------------------------------------------------------------------------------

const handles = $derived(handlesOf(content, $viewState))
const placed = $derived(
  handles.flatMap((handle) => {
    const at = project($viewState.orbit, size, handle.position)
    return at === undefined ? [] : [{ handle, at }]
  }),
)

let dragging: { id: string; start: Vec3; last: Vec3 } | undefined

/** Where the pointer puts a handle: on the plane facing the camera through where the handle began. */
function hit(event: PointerEvent, from: Vec3): Vec3 | undefined {
  const box = host?.getBoundingClientRect()
  if (box === undefined) return undefined
  const ray = pickRay($viewState.orbit, size, { x: event.clientX - box.left, y: event.clientY - box.top })
  return rayAtPlane(ray, dragPlane($viewState.orbit, from))
}

const round = (value: Vec3): Vec3 => [
  Math.round(value[0] * 1000) / 1000,
  Math.round(value[1] * 1000) / 1000,
  Math.round(value[2] * 1000) / 1000,
]

/**
 * A handle's own pointer listeners, native: Svelte delegates `pointerdown` to the root, so a press stopped here (so the
 * stage's gestures under it do not turn the figure as well) would never reach a delegated handler.
 */
const dragHandleWith =
  (id: Parameters<StudioController['dragHandle']>[0], position: Vec3) =>
  (node: HTMLElement): (() => void) => {
    const onDown = (event: PointerEvent): void => {
      event.stopPropagation()
      capture(event)
      controller.view.selectHandle(id)
      dragging = { id, start: position, last: position }
    }
    node.addEventListener('pointerdown', onDown)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    return () => {
      node.removeEventListener('pointerdown', onDown)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
  }

function move(event: PointerEvent): void {
  if (dragging === undefined) return
  const at = hit(event, dragging.start)
  if (at === undefined) return
  dragging.last = round(at)
  controller.dragHandle(dragging.id as never, dragging.last)
}
function up(event: PointerEvent): void {
  const drag = dragging
  dragging = undefined
  if (drag === undefined) return
  if (event.type === 'pointercancel') controller.cancelDrag()
  else if (drag.last !== drag.start) void controller.dropHandle(drag.id as never, drag.last)
  else controller.cancelDrag()
}
function key(event: KeyboardEvent, id: string, position: Vec3): void {
  const step = 0.02
  const delta: Record<string, Vec3> = {
    ArrowLeft: [step, 0, 0],
    ArrowRight: [-step, 0, 0],
    ArrowUp: [0, step, 0],
    ArrowDown: [0, -step, 0],
    PageUp: [0, 0, step],
    PageDown: [0, 0, -step],
  }
  const move = delta[event.key]
  if (move === undefined) return
  event.preventDefault()
  void controller.dropHandle(
    id as never,
    round([position[0] + move[0], position[1] + move[1], position[2] + move[2]]),
  )
}

/** Capture is best effort: a synthetic pointer, or one that already ended, has nothing to capture. */
function capture(event: PointerEvent): void {
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Nothing to capture.
  }
}
</script>

<div class="stage" bind:this={host} role="group" aria-label="Figure stage" data-testid="studio-stage" data-status={status} data-mode={$viewState.mode}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <div class="modes">
    <Segmented
      label="Studio mode"
      value={$viewState.mode}
      options={modes}
      onedit={(event) => controller.view.setMode(event.value as StudioMode)}
    />
  </div>
  {#if $viewState.mode === 'pose'}
    <div class="handles">
      {#each placed as { handle, at } (handle.id)}
        <button
          type="button"
          class="handle"
          class:amber={!handle.reached}
          class:chosen={$viewState.handle === handle.id}
          style:left={`${at.x}px`}
          style:top={`${at.y}px`}
          aria-label={`${handle.id} handle${handle.reached ? '' : ', out of reach'}`}
          aria-pressed={$viewState.handle === handle.id}
          data-handle={handle.id}
          {@attach dragHandleWith(handle.id, handle.position)}
          onkeydown={(event) => key(event, handle.id, handle.position)}
          onclick={() => controller.view.selectHandle(handle.id)}
        ></button>
      {/each}
    </div>
  {/if}
  {#if status === 'unavailable' || status === 'paused'}
    <div class="notice" role="status" data-testid="studio-stage-notice">
      <p>
        {status === 'unavailable'
          ? 'The stage needs WebGL2, and this browser has none. The fields still work.'
          : 'The picture stopped. The fields still work.'}
      </p>
      <Button onclick={() => (attempt += 1)}>Try again</Button>
    </div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 240px;
    overflow: hidden;
    touch-action: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .modes {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
  }
  .handles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .handle {
    position: absolute;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    padding: 0;
    border: 2px solid var(--color-accent, #d9a441);
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-accent, #d9a441) 25%, transparent);
    pointer-events: auto;
    touch-action: none;
  }
  .handle.chosen {
    background: var(--color-accent, #d9a441);
  }
  .handle.amber {
    border-color: var(--color-state-warn, #e0a030);
    background: color-mix(in srgb, var(--color-state-warn, #e0a030) 40%, transparent);
  }
  .notice {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: var(--space-3);
    padding: var(--space-5);
    background: var(--color-surface-base, #14161a);
    color: var(--color-text-dim);
    font: var(--text-body-13);
    text-align: center;
  }
  .notice p {
    margin: 0;
  }
</style>
