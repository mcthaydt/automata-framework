<!--
  A character on the canvas: how it behaves as a diagram, its switches as a list, and the rules the game decides by. On a
  phone the diagram and the list are two tabs; wider, they share the canvas.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { DECIDE_LINES, modeNotes } from './decide-words.ts'
import Diagram from './diagram/Diagram.svelte'
import { namesOf } from './names.ts'
import { modeWords } from './pieces/piece.ts'
import SwitchList from './SwitchList.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const character = $derived(session.character)
const index = $derived(session.chosen.kind === 'character' ? session.chosen.index : 0)
const names = $derived(
  session.def === undefined
    ? undefined
    : namesOf(session.def, index, Object.keys(session.places?.nodes ?? {})),
)
let tab = $state<'diagram' | 'list'>('diagram')
let zoom = $state(1)
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

{#if character !== undefined && names !== undefined}
  <header class="head">
    <h2>{modeWords(character.id)}</h2>
    <div class="tabs" role="tablist" aria-label="Show">
      <button type="button" role="tab" aria-selected={tab === 'diagram'} onclick={() => (tab = 'diagram')}>Diagram</button>
      <button type="button" role="tab" aria-selected={tab === 'list'} onclick={() => (tab = 'list')}>List</button>
    </div>
  </header>

  <section class="panel" data-active={tab === 'diagram'} aria-label="Diagram">
    <div class="tools">
      <Button onclick={() => (zoom = Math.min(2, zoom + 0.25))}>Bigger</Button>
      <Button onclick={() => (zoom = Math.max(1, zoom - 0.25))}>Smaller</Button>
      <Button onclick={() => (zoom = 1)}>Fit</Button>
    </div>
    <div class="scroll" tabindex="-1">
      <Diagram {character} {names} selected={session.selected} {zoom} onselect={(selection) => (session.selected = selection)} />
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
  .tabs button[aria-selected='true'] {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .panel {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .scroll {
    overflow: auto;
    max-width: 100%;
    max-height: 70vh;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    background: var(--color-bg-surface);
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
