<!--
  The Walk view's two sticks (ED3D.8b; ED3D spec §10): the left moves, the right looks, each a 120 px pad whose thumb follows
  the finger (or the mouse) to a tilt from -1 to 1 and springs back on release. The pads take their own presses with native
  listeners, so the view's gestures under them do not also turn the camera.
-->
<script lang="ts">
import type { Stick } from '../../app/walk-session'

interface Props {
  onstick: (which: 'move' | 'look', tilt: Stick) => void
}

const { onstick }: Props = $props()

const RADIUS = 60

let tilts = $state<Record<'move' | 'look', Stick>>({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } })

/** A pad's own pointer listeners: the tilt is the distance from the pad's centre over its radius, `y` up. */
const pad =
  (which: 'move' | 'look') =>
  (node: HTMLElement): (() => void) => {
    let id: number | undefined
    const set = (event: PointerEvent): void => {
      const box = node.getBoundingClientRect()
      const x = (event.clientX - (box.left + box.width / 2)) / RADIUS
      const y = -(event.clientY - (box.top + box.height / 2)) / RADIUS
      const length = Math.hypot(x, y)
      const tilt = length > 1 ? { x: x / length, y: y / length } : { x, y }
      tilts[which] = tilt
      onstick(which, tilt)
    }
    const down = (event: PointerEvent): void => {
      event.stopPropagation()
      if (id !== undefined) return
      id = event.pointerId
      try {
        node.setPointerCapture(event.pointerId)
      } catch {
        // A synthetic pointer has nothing to capture.
      }
      set(event)
    }
    const move = (event: PointerEvent): void => {
      if (event.pointerId === id) set(event)
    }
    const up = (event: PointerEvent): void => {
      if (event.pointerId !== id) return
      id = undefined
      tilts[which] = { x: 0, y: 0 }
      onstick(which, { x: 0, y: 0 })
    }
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    return () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    }
  }
</script>

{#each [{ which: 'move', label: 'Move stick', side: 'left' }, { which: 'look', label: 'Look stick', side: 'right' }] as const as stick (stick.which)}
  <div
    class="pad {stick.side}"
    role="group"
    aria-label={stick.label}
    data-testid={`stick-${stick.which}`}
    {@attach pad(stick.which)}
  >
    <span
      class="thumb"
      style:transform={`translate(${tilts[stick.which].x * RADIUS}px, ${-tilts[stick.which].y * RADIUS}px)`}
      aria-hidden="true"
    ></span>
  </div>
{/each}

<style>
  .pad {
    position: absolute;
    bottom: var(--space-4);
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    border: 2px solid color-mix(in srgb, var(--color-text-dim, #8a919e) 60%, transparent);
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-surface-base, #14161a) 55%, transparent);
    touch-action: none;
    pointer-events: auto;
  }
  .pad.left {
    left: var(--space-4);
  }
  .pad.right {
    right: var(--space-4);
  }
  .thumb {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-accent, #d9a441);
    opacity: 0.85;
  }
</style>
