<!--
  A character's modes and switches as a diagram, drawn in SVG in the page so every box and label is text a person (and a
  screen reader) can reach. Every box and label is a button, never smaller than 44 px at the smallest zoom. The layout is
  worked out from the character each time (`layout.ts`); the file holds no positions.
-->
<script lang="ts">
import type { AgentDef } from '@automata/systems/sim'
import { modeNotes } from '../decide-words.ts'
import type { Names } from '../pieces/piece.ts'
import { modeWords, num } from '../pieces/piece.ts'
import type { Selection } from '../schematic-session.svelte.ts'
import { ANY_MODE_WORDS, arrowLabel, switchWords, wrapLabel } from '../switch-words.ts'
import { layoutAgent } from './layout.ts'

interface Props {
  character: AgentDef
  names: Names
  selected: Selection | undefined
  /** How big the diagram is drawn, 1 being its natural size; never below `MIN_ZOOM`, so no target is under 44 px. */
  zoom: number
  onselect: (selection: Selection) => void
  /** While Watch runs: the mode this character is in now, and the switch that fired last. */
  live?:
    | {
        readonly mode: string | undefined
        readonly flash: { readonly from: string; readonly to: string } | undefined
      }
    | undefined
}

const { character, names, selected, zoom, onselect, live }: Props = $props()

// The "Any mode" arrow also fires when a switch from any mode does.
const fired = (from: string, to: string): boolean =>
  live?.flash !== undefined && live.flash.to === to && (from === live.flash.from || from === '*')

// Drawn at the size a finger can use: a box is 64 px tall and a label 52 (44 px at `MIN_ZOOM`).
const SIZE = { box: { w: 160, h: 64 }, gap: 168, label: 52, labelW: 144 }
const PAD = 12
const diagram = $derived(layoutAgent(character, SIZE))
const width = $derived(diagram.width + PAD * 2)
const height = $derived(diagram.height + PAD * 2)

const boxName = (mode: string): string => (mode === '*' ? ANY_MODE_WORDS : modeWords(mode))

function speedWords(mode: string): string {
  if (mode === '*') return 'while it moves'
  const speed = character.speed[mode] ?? 0
  return speed > 0 ? `${num(speed)} m/s` : 'stands still'
}

const pick =
  (selection: Selection) =>
  (event: Event): void => {
    event.preventDefault()
    onselect(selection)
  }
const onkey =
  (selection: Selection) =>
  (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') pick(selection)(event)
  }

const isMode = (mode: string): boolean => selected?.kind === 'mode' && selected.mode === mode
const hasSwitch = (switches: readonly number[]): boolean =>
  selected?.kind === 'switch' && switches.includes(selected.index)
const TAGS = { always: '', hears: 'when it hears', stops: 'when it stops' } as const
</script>

<svg
  class="diagram"
  role="group"
  aria-label={`How ${modeWords(character.id)} behaves`}
  viewBox={`${-PAD} ${-PAD} ${width} ${height}`}
  width={width * zoom}
  height={height * zoom}
>
  <defs>
    <marker id="arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" class="head" />
    </marker>
  </defs>

  {#each diagram.arrows as arrow (`${arrow.from}>${arrow.to}>${arrow.timing}`)}
    <polyline
      class="line"
      data-timing={arrow.timing}
      data-selected={hasSwitch(arrow.switches)}
      data-flash={fired(arrow.from, arrow.to)}
      points={arrow.points.map(([x, y]) => `${x},${y}`).join(' ')}
      marker-end="url(#arrow-head)"
    />
  {/each}

  {#each diagram.arrows as arrow (`label-${arrow.from}>${arrow.to}>${arrow.timing}`)}
    {@const first = arrow.switches[0] ?? 0}
    {@const text = arrowLabel(character, arrow.switches, names)}
    <g
      class="label"
      role="button"
      tabindex="0"
      data-timing={arrow.timing}
      aria-pressed={hasSwitch(arrow.switches)}
      aria-label={arrow.switches.map((i) => character.transitions[i] && switchWords(character.transitions[i], names)).join('; ')}
      onclick={pick({ kind: 'switch', index: first })}
      onkeydown={onkey({ kind: 'switch', index: first })}
    >
      <rect x={arrow.label.x} y={arrow.label.y} width={arrow.label.w} height={arrow.label.h} rx="4" />
      {#each wrapLabel(text) as line, at (at)}
        <text x={arrow.label.x + 8} y={arrow.label.y + 17 + at * 14}>{line}</text>
      {/each}
      {#if arrow.timing !== 'always'}
        <text class="tag" x={arrow.label.x + 8} y={arrow.label.y + 46}>{TAGS[arrow.timing]}</text>
        <title>{arrow.timing === 'hears' ? 'Checked the moment it hears a noise' : 'Checked after it stops or gets stuck'}</title>
      {/if}
    </g>
  {/each}

  {#each diagram.boxes as box (box.mode)}
    {@const notes = box.mode === '*' ? [] : modeNotes(character, box.mode)}
    <g
      class="box"
      data-mode={box.mode}
      role="button"
      tabindex="0"
      data-start={box.start}
      data-still={box.still}
      data-live={live?.mode === box.mode}
      aria-pressed={isMode(box.mode)}
      aria-label={`${boxName(box.mode)}, ${speedWords(box.mode)}${box.start ? ', where it starts' : ''}`}
      onclick={pick({ kind: 'mode', mode: box.mode })}
      onkeydown={onkey({ kind: 'mode', mode: box.mode })}
    >
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" />
      {#if box.start}<rect class="start" x={box.x} y={box.y} width="5" height={box.h} rx="2" />{/if}
      <text class="name" x={box.x + 14} y={box.y + 24}>{boxName(box.mode)}</text>
      <text class="speed" x={box.x + 14} y={box.y + 41}>{speedWords(box.mode)}</text>
      {#if box.patrol}<text class="tag" x={box.x + 14} y={box.y + 56}>Walks its patrol here</text>{/if}
      {#if notes.length > 0 && !box.patrol}<title>{notes.join('. ')}</title>{/if}
    </g>
  {/each}
</svg>

<style>
  .diagram {
    display: block;
    max-width: none;
    font: var(--text-body-13);
  }
  .box rect:not(.start),
  .label rect {
    fill: var(--color-bg-surface);
    stroke: var(--color-border-default);
    stroke-width: 1;
  }
  .box,
  .label {
    cursor: pointer;
    outline: none;
  }
  .box[aria-pressed='true'] rect:not(.start),
  .label[aria-pressed='true'] rect {
    fill: var(--color-accent-soft);
    stroke: var(--color-accent-default);
  }
  .box:focus-visible rect:not(.start),
  .label:focus-visible rect {
    stroke: var(--color-accent-default);
    stroke-width: 2;
  }
  .box[data-still='true'] rect:not(.start) {
    stroke-dasharray: 2 3;
  }
  .box[data-live='true'] rect:not(.start) {
    stroke: var(--color-accent-default);
    stroke-width: 3;
  }
  .line[data-flash='true'] {
    stroke: var(--color-accent-default);
    stroke-width: 3;
    animation: flash 1.2s ease-out;
  }
  @keyframes flash {
    from {
      stroke-width: 6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .line[data-flash='true'] {
      animation: none;
    }
  }
  .start {
    fill: var(--color-accent-default);
  }
  text {
    fill: var(--color-text-primary);
    font: var(--text-body-13);
    pointer-events: none;
  }
  .name {
    font: var(--text-body-13-medium);
  }
  .speed,
  .tag {
    fill: var(--color-text-dim);
    font-size: 11px;
  }
  .line {
    fill: none;
    stroke: var(--color-text-dim);
    stroke-width: 1.5;
  }
  .line[data-timing='hears'],
  .line[data-timing='stops'],
  .label[data-timing='hears'] rect,
  .label[data-timing='stops'] rect {
    stroke-dasharray: 5 4;
  }
  .line[data-selected='true'] {
    stroke: var(--color-accent-default);
    stroke-width: 2.5;
  }
  .head {
    fill: var(--color-text-dim);
  }
</style>
