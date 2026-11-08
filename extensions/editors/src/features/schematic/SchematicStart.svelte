<!--
  What Schematic says when there is nothing to edit yet: the game does not use characters that think, the scene has none,
  the editor list does not name the files, or the file has a mistake. Each says what to do next, in one line.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import { LIST_ROWS } from './schematic-facts.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const read = $derived(session.read)
const README = 'https://github.com/mcthaydt/automata-framework/blob/main/extensions/systems/README.md'
const missingRows = $derived(!session.facts.listsSystems || !session.facts.listsNav)
</script>

<div class="empty">
  {#if !session.facts.usesSystems}
    <h2>This game does not use characters that think yet.</h2>
    <p>Add the systems extension to your game to use Schematic.</p>
    <a href={README}>How to add it</a>
  {:else if read.kind === 'syntax'}
    <h2>This scene's file has a mistake{read.line === undefined ? '' : ` on line ${String(read.line)}`}.</h2>
    <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
  {:else}
    <h2>This scene has no characters yet.</h2>
    <p>A character is an enemy or a friend that walks, notices the player and decides what to do.</p>
    {#if missingRows}
      <p>Your game's list of editors does not name these files yet. Add this to it, then come back:</p>
      <pre aria-label="What to add to your list of editors">{LIST_ROWS}</pre>
    {/if}
    {#if session.places === undefined || Object.keys(session.places.nodes).length === 0}
      <p>A character walks between places, so add the places first. One added now has nowhere to walk and stands in the corner.</p>
      <Button disabled={!session.facts.listsNav} onclick={() => (session.chosen = { kind: 'places' })}>Add the first place</Button>
    {/if}
    <Button variant="primary" disabled={!session.facts.listsSystems} onclick={() => void session.addCharacter()}>Add a character</Button>
  {/if}
</div>

<style>
  .empty {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  p {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  pre {
    margin: 0;
    padding: var(--space-3);
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-mono-12, var(--text-body-13));
    user-select: all;
  }
  a {
    color: var(--color-accent);
    font: var(--text-body-13);
  }
</style>
