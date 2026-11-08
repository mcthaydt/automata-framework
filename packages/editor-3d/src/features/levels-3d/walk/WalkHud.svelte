<!--
  The Walk view's overlay (ED3D.8b; ED3D spec §6, §9, §10): the crosshair at the middle, the mode switch (Walk, Fly, Orbit),
  the selection chip saying what the crosshair is on, the warning when the start was a guess (ED3-n), the minimap of the
  level with the eye on it, Fly's up and down buttons, and the two sticks. Everything but the crosshair takes presses;
  the canvas under it takes the rest.
-->
<script lang="ts">
import { Segmented } from '@automata/editor/kit'
import WalkSticks from './WalkSticks.svelte'
import { type Minimap } from './walk-hud'
import type { Stick, WalkMode, WalkView } from './walk-session'

interface Props {
  view: WalkView
  minimap: Minimap
  words: string
  onmode: (mode: WalkMode) => void
  onstick: (which: 'move' | 'look', tilt: Stick) => void
  onlift: (amount: number) => void
}

const { view, minimap, words, onmode, onstick, onlift }: Props = $props()

const modes = [
  { id: 'walk', label: 'Walk' },
  { id: 'fly', label: 'Fly' },
  { id: 'orbit', label: 'Orbit' },
]

/** A lift button: held while pressed. Native listeners, so the view's gestures under it hear nothing. */
const hold =
  (amount: number) =>
  (node: HTMLElement): (() => void) => {
    const down = (event: PointerEvent): void => {
      event.stopPropagation()
      onlift(amount)
    }
    const up = (): void => onlift(0)
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    node.addEventListener('pointerleave', up)
    return () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
      node.removeEventListener('pointerleave', up)
    }
  }
</script>

<div class="hud" data-testid="walk-hud">
  <span class="crosshair" aria-hidden="true"></span>
  <div class="modes">
    <Segmented label="Walk mode" options={modes} value={view.mode} onedit={(event) => onmode(event.value as WalkMode)} />
  </div>
  <div class="under">
    <p class="chip" data-testid="walk-chip" role="status">{words}</p>
    {#if view.warning !== undefined}<p class="warning" role="status" data-testid="walk-warning">{view.warning}</p>{/if}
  </div>
  <svg class="minimap" viewBox="0 0 120 90" role="img" aria-label="Minimap" data-testid="walk-minimap">
    {#each minimap.rooms as room, index (index)}
      <polygon points={room.join(' ')} class="room" />
    {/each}
    <circle cx={minimap.eye.x} cy={minimap.eye.y} r="3" class="eye" />
    <line x1={minimap.eye.x} y1={minimap.eye.y} x2={minimap.heading.x} y2={minimap.heading.y} class="heading" />
  </svg>
  {#if view.mode === 'fly'}
    <div class="lift">
      <button type="button" aria-label="Fly up" {@attach hold(1)}>Up</button>
      <button type="button" aria-label="Fly down" {@attach hold(-1)}>Down</button>
    </div>
  {/if}
  <WalkSticks {onstick} />
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    /* The words sit over the picture, so they carry their own dark plate and light words, whatever the editor's theme. */
    --plate: rgba(12, 13, 16, 0.82);
    --plate-text: #f2f4f8;
    --plate-warning: #f0b44c;
    --minimap-height: 90px;
  }
  .crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    background:
      linear-gradient(var(--lime), var(--lime)) center / 2px 100% no-repeat,
      linear-gradient(var(--lime), var(--lime)) center / 100% 2px no-repeat;
  }
  .modes {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    pointer-events: auto;
  }
  /* Under the mode switch and the minimap, which are the top row, so the words never sit over either: the row's height
     is the minimap's, one number both read, so a taller row moves the words with it. The chip and the warning stack in
     this column, so one cannot lie over the other. */
  .under {
    position: absolute;
    top: calc(var(--space-3) + var(--minimap-height) + var(--space-2));
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    max-width: calc(100% - 2 * var(--space-3));
    transform: translateX(-50%);
  }
  .chip,
  .warning {
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--edge-lg);
    background: var(--plate);
    color: var(--plate-text);
    white-space: nowrap;
  }
  .chip {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .warning {
    color: var(--plate-warning);
    white-space: normal;
    text-align: center;
  }
  .minimap {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: 120px;
    height: var(--minimap-height);
    border-radius: var(--edge-lg);
    background: color-mix(in srgb, var(--color-bg-canvas) 80%, transparent);
  }
  .room {
    fill: color-mix(in srgb, var(--color-text-dim, #8a919e) 35%, transparent);
    stroke: var(--color-text-dim, #8a919e);
    stroke-width: 1;
  }
  .eye {
    fill: var(--lime);
  }
  .heading {
    stroke: var(--lime);
    stroke-width: 2;
  }
  .lift {
    position: absolute;
    right: calc(var(--space-4) + 140px);
    bottom: var(--space-4);
    display: grid;
    gap: var(--space-2);
    pointer-events: auto;
  }
  .lift button {
    min-width: 64px;
    min-height: 48px;
    border: 1px solid var(--stage-line);
    border-radius: var(--edge-lg);
    background: color-mix(in srgb, var(--color-bg-canvas) 80%, transparent);
    color: inherit;
    font: inherit;
    touch-action: none;
  }
</style>
