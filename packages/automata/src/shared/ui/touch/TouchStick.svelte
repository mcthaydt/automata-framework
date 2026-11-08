<!--
  @component
  The floating move stick on the touch overlay, from The Last Light `src/input.ts` and
  `src/ui.ts` at `92e6704`: the stick's origin is where the thumb lands in its zone, and the thumb's offset from it
  over `TOUCH_STICK_RADIUS_PX` is the vector, clamped to length 1. One finger drives it; others on the zone are
  ignored. The zone captures that finger, so the release always arrives however far the thumb wanders.

  The ring is drawn inside the region the geometry owner leaves visible: held, it centres on the landing
  point moved the least distance that keeps all of it on screen and clear of the insets, while the vector still runs
  from where the thumb landed; at rest it sits inside the zone, which the frame keeps inside the insets.

  The vector goes out through `onstick` as the thumb moves; the release goes out through `onstickend` exactly once,
  for a lift, a cancel, a lost capture, the overlay hiding or the stick coming down. The dead zone is runtime's
  (`Input.touchStick`), not drawn here. Pointer only: never in the focus order.
-->
<script lang="ts">
import { onDestroy } from 'svelte'
import { publishedVisibleRect } from '../geometry/geometry'
import { clampRingCentre, stickVector, TOUCH_STICK_RADIUS_PX } from './touch-stick'

interface Props {
  /** The stick's accessible name ("Move"). */
  label: string
  onstick: (x: number, y: number) => void
  onstickend: () => void
  /** False lets go of a held stick (the overlay hid). */
  shown: boolean
  testId?: string | undefined
}

const { label, onstick, onstickend, shown, testId = 'touch-stick' }: Props = $props()

/**
 * The finger driving the stick and where it landed, in the zone's box; none while idle. Plain, not `$state`: the
 * release on teardown must still see it. `phase` is what the zone draws.
 */
let held: { readonly id: number; readonly x: number; readonly y: number } | undefined
let phase = $state<'idle' | 'held'>('idle')
let ring = $state<{ readonly x: number; readonly y: number } | undefined>(undefined)
let knob = $state({ x: 0, y: 0 })
let ringElement: HTMLElement | undefined

/** Where the ring is drawn for a thumb landing at `landing` in the zone's box: inside the visible region. */
function ringAt(
  zone: HTMLElement,
  box: DOMRect,
  landing: { x: number; y: number },
): { x: number; y: number } {
  const view = zone.ownerDocument.defaultView
  const root = zone.ownerDocument.documentElement
  const area = publishedVisibleRect(root, { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 })
  // The ring's whole box, its edge included.
  const half = (ringElement?.offsetWidth ?? 0) / 2
  const centre = clampRingCentre({ x: box.left + landing.x, y: box.top + landing.y }, half, area)
  return { x: centre.x - box.left, y: centre.y - box.top }
}

function end(): void {
  if (held === undefined) return
  held = undefined
  phase = 'idle'
  ring = undefined
  knob = { x: 0, y: 0 }
  onstickend()
}

function down(event: PointerEvent): void {
  event.preventDefault()
  if (held !== undefined) return
  const zone = event.currentTarget as HTMLElement
  const box = zone.getBoundingClientRect()
  held = { id: event.pointerId, x: event.clientX - box.left, y: event.clientY - box.top }
  phase = 'held'
  ring = ringAt(zone, box, held)
  try {
    zone.setPointerCapture?.(event.pointerId)
  } catch {
    // A synthetic or already-ended pointer has nothing to capture; the stick still holds.
  }
}

function move(event: PointerEvent): void {
  if (held === undefined || event.pointerId !== held.id) return
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const vector = stickVector(event.clientX - box.left - held.x, event.clientY - box.top - held.y)
  knob = { x: vector.x * TOUCH_STICK_RADIUS_PX, y: vector.y * TOUCH_STICK_RADIUS_PX }
  onstick(vector.x, vector.y)
}

function up(event: PointerEvent): void {
  if (held !== undefined && event.pointerId === held.id) end()
}

$effect(() => {
  if (!shown) end()
})
onDestroy(end)
</script>

<div
  class="af-touch__stick"
  data-testid={testId}
  data-touch-stick
  data-stick-state={phase}
  role="group"
  tabindex="-1"
  aria-label={label}
  style:--af-stick-radius={`${TOUCH_STICK_RADIUS_PX}px`}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
>
  <div
    bind:this={ringElement}
    class="af-touch__stick-ring"
    aria-hidden="true"
    style:left={ring === undefined ? undefined : `${ring.x}px`}
    style:top={ring === undefined ? undefined : `${ring.y}px`}
  >
    <div class="af-touch__stick-knob" style:transform={`translate(${knob.x}px, ${knob.y}px)`}></div>
  </div>
</div>

<style>
  /* The zone: twice the primary target on each side, so the thumb has room to land anywhere in it. */
  .af-touch__stick {
    position: relative;
    /* Above a start-side button group's sticky margin, which reaches into the gap beside it. */
    z-index: 1;
    flex: none;
    pointer-events: auto;
    width: calc(2 * var(--af-target-primary));
    height: calc(2 * var(--af-target-primary));
    touch-action: none;
  }

  /* A sideways phone has no height to spare (780 x 270): the zone keeps its width and one primary target of
     height. The stick floats, and the captured thumb may travel past the zone, so its reach is unchanged; the ring
     is drawn on screen all the same. */
  :global([data-height='compact']) .af-touch__stick {
    height: var(--af-target-primary);
  }

  /* The ring: at rest in the middle of the zone, its edge never past the zone's start (the ring, edge included, is
     a little wider than a zone at scale 1, and the zone may stand right at an inset); held, centred where the thumb
     landed, as far as the visible region allows (script). */
  .af-touch__stick-ring {
    position: absolute;
    left: max(50%, calc(var(--af-stick-radius) + var(--af-edge-width)));
    top: 50%;
    display: grid;
    place-items: center;
    width: calc(2 * var(--af-stick-radius));
    height: calc(2 * var(--af-stick-radius));
    border: var(--af-edge-width) solid var(--af-ink);
    border-radius: 50%;
    opacity: 0.6;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /* At a compact height the zone is shorter than the ring: at rest the ring stands on the zone's foot, which the
     frame keeps inside the insets, rather than running past the screen's edge below it. */
  :global([data-height='compact']) .af-touch__stick[data-stick-state='idle'] .af-touch__stick-ring {
    top: auto;
    bottom: 0;
    transform: translate(-50%, 0);
  }

  .af-touch__stick[data-stick-state='held'] .af-touch__stick-ring {
    border-color: var(--af-accent);
    opacity: 1;
  }

  .af-touch__stick-knob {
    width: var(--af-target);
    height: var(--af-target);
    border-radius: 50%;
    background: var(--af-ink);
    opacity: 0.8;
  }
</style>
