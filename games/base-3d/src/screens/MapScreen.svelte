<!--
  base-3d's Map screen (DESIGN.md §9.4, GAME-3D.1e part 5c), over the paused game: the area's plan from its compiled
  geometry (`mapOf`), north up, scaled to the container and at least 240 px tall, so at compact height it scrolls inside
  its declared scroll region while the frame's corner Close stays fixed. The room Wick stands in is filled bright, the
  visited ones filled, the rest outlined (with the map); his arrow points along his facing and a wedge shows the
  camera's view.
-->
<script lang="ts">
import { ScreenFrame } from '@mcthaydt/automata-ui'
import { liveCopy } from './copy.svelte.ts'
import type { MapPlan } from './map.ts'

interface Props {
  plan: MapPlan
  onClose: () => void
}

const { plan, onClose }: Props = $props()

/** The margin round the plan, in metres, so the walls and the arrow at an edge stay inside the drawing. */
const MARGIN = 1
/** The plan is never drawn shorter than this, in CSS px: below it the region scrolls. */
const MIN_HEIGHT = 240
/** The camera wedge's reach, in metres, and its half angle. */
const WEDGE_REACH = 2.5
const WEDGE_HALF_DEG = 30

const words = $derived(liveCopy.current)
let region = $state<HTMLElement | undefined>(undefined)
let arrow = $state<SVGElement | undefined>(undefined)
let centred = false
let regionWidth = $state(0)
let regionHeight = $state(0)

/** Scrolls the region so Wick's arrow is in its middle, as far as it can scroll. */
function centreOnWick(): void {
  if (region === undefined || arrow === undefined || regionHeight === 0) return
  centred = true
  const box = region.getBoundingClientRect()
  const wick = arrow.getBoundingClientRect()
  region.scrollTop += wick.top + wick.height / 2 - (box.top + box.height / 2)
  region.scrollLeft += wick.left + wick.width / 2 - (box.left + box.width / 2)
}

// The region's size, followed as it changes (rotation, the browser bar). Where nothing lays out (no ResizeObserver,
// as in jsdom), the plan is drawn at its smallest.
$effect(() => {
  const element = region
  if (element === undefined || typeof ResizeObserver === 'undefined') return
  const measure = (): void => {
    regionWidth = element.clientWidth
    regionHeight = element.clientHeight
    // Once drawn at its size, the plan opens scrolled to Wick, so a short screen still shows where he is.
    if (!centred) requestAnimationFrame(centreOnWick)
  }
  const observer = new ResizeObserver(measure)
  observer.observe(element)
  measure()
  return () => observer.disconnect()
})

const width = $derived(plan.bounds.maxX - plan.bounds.minX + 2 * MARGIN)
const height = $derived(plan.bounds.maxZ - plan.bounds.minZ + 2 * MARGIN)
// Metres to CSS px: the plan fits the region's width, and its height down to `MIN_HEIGHT`.
const scale = $derived(Math.min(regionWidth / width, Math.max(regionHeight, MIN_HEIGHT) / height))
// The SVG's y grows down, so a plan point (x, z) is drawn at (x, −z): north up.
const viewBox = $derived(`${plan.bounds.minX - MARGIN} ${-plan.bounds.maxZ - MARGIN} ${width} ${height}`)
const wedge = (() => {
  const toRad = Math.PI / 180
  const left = -WEDGE_HALF_DEG * toRad
  const right = WEDGE_HALF_DEG * toRad
  return `M0 0 L${WEDGE_REACH * Math.sin(left)} ${-WEDGE_REACH * Math.cos(left)} A${WEDGE_REACH} ${WEDGE_REACH} 0 0 1 ${WEDGE_REACH * Math.sin(right)} ${-WEDGE_REACH * Math.cos(right)} Z`
})()
</script>

{#snippet header()}
  <h2 class="b3-map__title">{words.map.title}</h2>
{/snippet}

{#snippet body()}
  <div
    class="b3-map"
    data-scroll-region
    data-testid="map-scroll"
    bind:this={region}
  >
    <svg
      class="b3-map__plan"
      data-testid="map-plan"
      role="img"
      aria-label={words.map.plan}
      {viewBox}
      width={Math.max(0, width * scale)}
      height={Math.max(0, height * scale)}
    >
      {#each plan.rooms as room (room.id)}
        <rect
          class="b3-map__room"
          data-room={room.id}
          data-state={room.state}
          x={room.minX}
          y={-room.maxZ}
          width={room.maxX - room.minX}
          height={room.maxZ - room.minZ}
        />
      {/each}
      {#each plan.walls as wall, index (index)}
        <rect
          class="b3-map__wall"
          x={wall.minX}
          y={-wall.maxZ}
          width={wall.maxX - wall.minX}
          height={wall.maxZ - wall.minZ}
        />
      {/each}
      <g transform={`translate(${plan.wick.x} ${-plan.wick.z})`}>
        <path class="b3-map__wedge" data-testid="map-heading" d={wedge} transform={`rotate(${plan.headingDeg})`} />
        <path
          class="b3-map__wick"
          data-testid="map-wick"
          bind:this={arrow}
          d="M0 -0.7 L0.45 0.45 L0 0.2 L-0.45 0.45 Z"
          transform={`rotate(${plan.wick.facingDeg})`}
        />
      </g>
    </svg>
  </div>
{/snippet}

<div class="af-game-menu af-game-menu--scrim" data-game-screen="map">
  <ScreenFrame arrangement="stack" testId="map-screen" back={onClose} backLabel={words.map.close} {header} {body} />
</div>

<style>
  .b3-map__title {
    margin: 0;
    font: var(--af-text-body);
  }
  .b3-map {
    min-block-size: 0;
    block-size: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    display: grid;
    justify-items: center;
    align-content: start;
  }
  /* A panel under the plan, so the paused game behind never reads as part of the map. */
  .b3-map__plan {
    display: block;
    border-radius: var(--af-radius);
    background: var(--af-panel);
  }
  .b3-map__room {
    stroke: var(--af-ink);
    stroke-width: 0.08;
    fill: none;
  }
  .b3-map__room[data-state='outline'] {
    stroke: var(--af-muted);
    stroke-dasharray: 0.3 0.2;
  }
  .b3-map__room[data-state='visited'] {
    fill: rgb(255 255 255 / 18%);
  }
  .b3-map__room[data-state='here'] {
    fill: rgb(247 118 34 / 35%);
  }
  .b3-map__wall {
    fill: var(--af-ink);
    opacity: 0.6;
  }
  .b3-map__wedge {
    fill: rgb(44 232 245 / 30%);
  }
  .b3-map__wick {
    fill: #fee761;
    stroke: #181425;
    stroke-width: 0.06;
  }
</style>
