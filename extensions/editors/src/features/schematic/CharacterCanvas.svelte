<!--
  A character on the canvas: how it behaves as a diagram, its switches as a list, and the rules the game decides by. On a
  phone the diagram and the list are two tabs; wider, they share the canvas.
-->
<script lang="ts">
import { FloatingToolbar, IconButton } from '@automata/editor/kit'
import { tick } from 'svelte'
import { DECIDE_LINES, modeNotes } from './decide-words.ts'
import Diagram from './diagram/Diagram.svelte'
import { reveal } from './diagram/reveal.ts'
import { sceneNames } from './names.ts'
import { modeWords } from './pieces/piece.ts'
import SwitchList from './SwitchList.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'
import WatchPane from './WatchPane.svelte'
import { EMPTY_WATCH, type WatchState } from './watch-log.ts'

const { session }: { session: SchematicSession } = $props()
const character = $derived(session.character)
const index = $derived(session.chosen.kind === 'character' ? session.chosen.index : 0)
const names = $derived(sceneNames(session, index))
let tab = $state<'diagram' | 'list'>('diagram')
// The smallest the diagram draws: the 52 px labels are then still 44 px, a finger's floor.
const MIN_ZOOM = 0.85
let zoom = $state(1)
let scroller = $state<HTMLElement>()
// The board's area is as wide as its pane and as high as the share of the window it may take. Where that is narrower than
// it is high (a phone, an upright iPad) the board lays out tall, so its words stay the size a finger can use instead of
// shrinking to fit the width; it follows the area, not the device.
const BOARD_SHARE = 0.7
let room = $state(0)
let windowHeight = $state(0)
const tall = $derived(room > 0 && room < windowHeight * BOARD_SHARE)
let watching = $state(false)
let heard = $state<WatchState>(EMPTY_WATCH)
const live = $derived(
  watching && character !== undefined
    ? {
        mode: heard.modes[character.id],
        flash: heard.flash?.agent === character.id ? heard.flash : undefined,
      }
    : undefined,
)

/** Fit: as much of the diagram as the pane holds without going under the finger floor, opened on where it starts. */
async function fit(): Promise<void> {
  const width = scroller?.querySelector('svg')?.viewBox.baseVal.width ?? 0
  const room = scroller?.clientWidth ?? 0
  zoom = width > 0 && room > 0 ? Math.max(MIN_ZOOM, Math.min(1, room / width)) : 1
  await tick()
  if (scroller !== undefined && character !== undefined) {
    scroller.scrollTo(0, 0)
    reveal(scroller, character.initial)
  }
}

// Watch lights one box at a time; the lit one is brought into view so the person sees it light.
$effect(() => {
  const lit = live?.mode
  if (lit !== undefined && scroller !== undefined) reveal(scroller, lit)
})

const notes = $derived(
  character === undefined
    ? []
    : character.modes.flatMap((mode) =>
        modeNotes(character, mode)
          .filter((n) => n.startsWith('This'))
          .map((n) => `${modeWords(mode)}: ${n}`),
      ),
)
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#if character !== undefined && names !== undefined}
  <header class="head">
    <h2>{modeWords(character.id)}</h2>
    <div class="tabs" role="tablist" aria-label="Show">
      <button type="button" role="tab" aria-selected={tab === 'diagram'} onclick={() => (tab = 'diagram')}>Diagram</button>
      <button type="button" role="tab" aria-selected={tab === 'list'} onclick={() => (tab = 'list')}>List</button>
    </div>
    <button type="button" class="watch-toggle" aria-pressed={watching} onclick={() => (watching = !watching)}>Watch it run</button>
  </header>

  {#if watching}
    <WatchPane {session} onchange={(state) => (heard = state)} />
  {/if}

  <section class="panel" data-active={tab === 'diagram'} aria-label="Diagram">
    <div class="stage">
      <div
        class="scroll"
        tabindex="-1"
        style:max-height="{BOARD_SHARE * 100}vh"
        bind:this={scroller}
        bind:clientWidth={room}
      >
        <Diagram {character} {names} selected={session.selected} {zoom} {tall} {live} onselect={(selection) => (session.selected = selection)} />
      </div>
      <FloatingToolbar label="Board size" at="zoom">
        <IconButton icon="plus" label="Bigger" onclick={() => (zoom = Math.min(2, zoom + 0.25))} />
        <IconButton icon="minus" label="Smaller" onclick={() => (zoom = Math.max(MIN_ZOOM, zoom - 0.25))} />
        <IconButton icon="fit" label="Fit" onclick={fit} />
      </FloatingToolbar>
    </div>
    {#if notes.length > 0}
      <ul class="notes">
        {#each notes as note (note)}<li>{note}</li>{/each}
      </ul>
    {/if}
  </section>

  <section class="panel" data-active={tab === 'list'} aria-label="Switches">
    <SwitchList {character} {names} selected={session.selected} onselect={(selection) => (session.selected = selection)} />
  </section>

  <section class="rules" aria-label="How it decides">
    <h3>How it decides</h3>
    <ul>
      {#each DECIDE_LINES as line (line)}<li>{line}</li>{/each}
    </ul>
  </section>
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .tabs {
    display: inline-flex;
    gap: var(--space-1);
  }
  .tabs button {
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .watch-toggle {
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  .watch-toggle[aria-pressed='true'],
  .tabs button[aria-selected='true'] {
    border-color: var(--color-accent-default);
    background: var(--color-accent-soft);
  }
  .panel {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  /* The board sits on the stage: the same dotted floor in both looks, with its size controls floating over it. */
  .stage {
    position: relative;
    container-type: inline-size;
  }
  .scroll {
    overflow: auto;
    max-width: 100%;
    border-radius: var(--edge-md);
    background-color: var(--tool-stage, var(--charcoal));
    background-image: radial-gradient(circle, var(--tool-dot, transparent) 1px, transparent 1.5px);
    background-size: 20px 20px;
  }
  .notes,
  .rules ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding-left: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .rules {
    display: grid;
    gap: var(--space-2);
  }
  .rules h3 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
  }
  /* On a phone the diagram and the list are two tabs; from a tablet up they sit one above the other. */
  @media (max-width: 719px) {
    .panel[data-active='false'] {
      display: none;
    }
  }
  @media (min-width: 720px) {
    .tabs {
      display: none;
    }
  }
</style>
