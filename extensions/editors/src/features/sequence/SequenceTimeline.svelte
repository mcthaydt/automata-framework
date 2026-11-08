<!--
  The cutscene as rows of marks over a ruler in seconds. A row's name stays pinned while the rows scroll sideways in
  their own region. A step is a mark (a bar when it lasts); tapping it selects it, and dragging it along its row moves
  it, snapped to a tenth of a second. Tapping or dragging the ruler moves the playhead.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { SOUNDS_WORDS } from './key-fields.ts'
import SequenceAddStep from './SequenceAddStep.svelte'
import type { SequenceSession } from './sequence-session.svelte.ts'
import { addableRows, type Mark, type Row, rows } from './tracks.ts'

const { session }: { session: SequenceSession } = $props()

const MARK = 44
const script = $derived(session.script)
const lanes = $derived(script === undefined ? [] : rows(script, session.is2d))
const addable = $derived(script === undefined ? [] : addableRows(script, session.is2d))
const width = $derived((script?.duration ?? 0) * session.zoom)
const ticks = $derived(
  Array.from({ length: Math.floor(script?.duration ?? 0) + 1 }, (_, second) => second).filter(
    (second) => session.zoom >= 40 || second % 5 === 0,
  ),
)
const problems = $derived(session.problems)

let adding = $state<{ track: Row['track']; who?: string } | undefined>()
let choosingRow = $state(false)
let drag = $state<{ row: string; index: number; from: number; dx: number; moved: boolean } | undefined>()
let justDragged = false

const seconds = (value: number): string => String(Math.round(value * 10) / 10)

function labelOf(row: Row, mark: Mark): string {
  const when =
    mark.until === undefined ? `${seconds(mark.t)} s` : `${seconds(mark.t)} s to ${seconds(mark.until)} s`
  return `${row.words}, ${when}`
}

const problemOf = (row: Row, mark: Mark): string | undefined =>
  problems.find((found) => found.track === row.track && found.index === mark.index)?.words

function down(event: PointerEvent & { currentTarget: HTMLElement }, row: Row, mark: Mark): void {
  if (row.track === 'sound') return
  event.currentTarget.setPointerCapture?.(event.pointerId)
  drag = { row: row.id, index: mark.index, from: event.clientX, dx: 0, moved: false }
}

function over(event: PointerEvent): void {
  if (drag === undefined) return
  const dx = event.clientX - drag.from
  drag = { ...drag, dx, moved: drag.moved || Math.abs(dx) > 4 }
}

async function up(row: Row, mark: Mark): Promise<void> {
  const current = drag
  drag = undefined
  if (current === undefined || !current.moved) return
  justDragged = true
  await session.move(row.track, mark.index, mark.t + current.dx / session.zoom)
}

function select(row: Row, mark: Mark): void {
  if (justDragged) {
    justDragged = false
    return
  }
  session.select({ track: row.track, index: mark.index })
}

let seeking = false
function seekAt(event: PointerEvent & { currentTarget: HTMLElement }): void {
  const box = event.currentTarget.getBoundingClientRect()
  session.seek((event.clientX - box.left) / session.zoom)
}
</script>

<section class="timeline" aria-label="Timeline">
  <div class="scroll">
    <div class="grid" style="--seconds: {session.zoom}px; width: calc(9rem + {width}px)">
      <div class="head">Time</div>
      <div
        class="ruler"
        role="slider"
        tabindex="0"
        aria-label="Playhead"
        aria-valuemin="0"
        aria-valuemax={script?.duration ?? 0}
        aria-valuenow={session.playhead}
        aria-valuetext="{seconds(session.playhead)} s"
        onpointerdown={(event) => {
          seeking = true
          event.currentTarget.setPointerCapture?.(event.pointerId)
          seekAt(event)
        }}
        onpointermove={(event) => {
          if (seeking) seekAt(event)
        }}
        onpointerup={() => (seeking = false)}
        onkeydown={(event) => {
          if (event.key === 'ArrowRight') session.seek(session.playhead + 0.1)
          if (event.key === 'ArrowLeft') session.seek(session.playhead - 0.1)
        }}
      >
        {#each ticks as second (second)}<span class="tick" style="left: {second * session.zoom}px">{second}</span>{/each}
        <span class="playhead" style="left: {session.playhead * session.zoom}px"></span>
      </div>
      {#each lanes as row (row.id)}
        {@const height = Math.max(1, ...row.marks.map((mark) => mark.lane + 1)) * (MARK + 4)}
        <div class="name">
          <span>{row.words}</span>
          {#if row.only3d}<small>Only in 3D games</small>{/if}
          {#if row.track === 'sound'}
            <small>{SOUNDS_WORDS}</small>
          {:else}
            <button type="button" class="here" onclick={() => (adding = { track: row.track, ...(row.who === undefined ? {} : { who: row.who }) })}>
              Add here
            </button>
          {/if}
        </div>
        <div class="lane" style="height: {height}px">
          {#each row.marks as mark (mark.index)}
            {@const moving = drag?.row === row.id && drag.index === mark.index && drag.moved}
            {@const problem = problemOf(row, mark)}
            <button
              type="button"
              class="mark"
              class:bar={mark.until !== undefined}
              class:moving
              class:bad={problem !== undefined}
              disabled={row.track === 'sound'}
              style="left: {mark.t * session.zoom + (moving ? (drag?.dx ?? 0) : 0)}px; top: {mark.lane * (MARK + 4)}px; width: {mark.until === undefined ? MARK : Math.max(MARK, (mark.until - mark.t) * session.zoom)}px"
              aria-label={labelOf(row, mark)}
              aria-pressed={session.selection?.track === row.track && session.selection.index === mark.index}
              title={problem}
              onpointerdown={(event) => down(event, row, mark)}
              onpointermove={over}
              onpointerup={() => void up(row, mark)}
              onclick={() => select(row, mark)}
            >
              {#if problem !== undefined}<span aria-hidden="true">!</span>{/if}
            </button>
          {/each}
          <span class="playhead" style="left: {session.playhead * session.zoom}px"></span>
        </div>
      {/each}
    </div>
  </div>

  <div class="rows">
    {#if adding !== undefined}
      <SequenceAddStep {session} track={adding.track} who={adding.who} ondone={() => (adding = undefined)} />
    {:else if choosingRow}
      <ul class="choices" aria-label="Rows to add">
        {#each addable as option (option.track)}
          <li>
            <Button
              onclick={() => {
                choosingRow = false
                adding = { track: option.track }
              }}
            >
              {option.words}{option.only3d ? ' (Only in 3D games)' : ''}
            </Button>
          </li>
        {/each}
        <li><Button variant="quiet" onclick={() => (choosingRow = false)}>Cancel</Button></li>
      </ul>
    {:else}
      <Button onclick={() => (choosingRow = true)}>Add a row</Button>
    {/if}
  </div>
</section>

<style>
  .timeline {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
  }
  .grid {
    display: grid;
    grid-template-columns: 9rem 1fr;
    min-width: 100%;
  }
  .head,
  .name {
    position: sticky;
    left: 0;
    z-index: 2;
    display: grid;
    align-content: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border-bottom: 1px solid var(--color-border-default);
    background: var(--color-bg-app);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  small {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .here {
    min-height: var(--size-hit);
    border: 0;
    background: transparent;
    color: var(--color-accent-default);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .ruler,
  .lane {
    position: relative;
    border-bottom: 1px solid var(--color-border-default);
  }
  .ruler {
    height: var(--size-hit);
    touch-action: none;
    cursor: pointer;
  }
  .tick {
    position: absolute;
    top: 0;
    padding-left: 2px;
    border-left: 1px solid var(--color-border-default);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    /* The one lime in Sequence: where the cutscene is now. */
    background: var(--lime);
    pointer-events: none;
  }
  .mark {
    position: absolute;
    box-sizing: border-box;
    min-height: 44px;
    border: 1px solid var(--color-accent-default);
    border-radius: var(--edge-sm);
    background: var(--color-accent-soft);
    color: var(--color-text-primary);
    touch-action: none;
    cursor: grab;
  }
  .mark[aria-pressed='true'] {
    background: var(--color-accent-default);
    color: var(--color-accent-ink);
  }
  .mark.bad {
    border-color: var(--color-state-bad);
  }
  .mark:disabled {
    cursor: default;
    opacity: 0.6;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
