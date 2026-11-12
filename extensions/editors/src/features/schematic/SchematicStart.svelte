<!--
  What Schematic says when there is nothing to edit yet: the game does not use characters that think, the scene has none,
  or the file has a mistake. Each says what to do next, in one line.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import NoPlayer from '../../shared/ui/NoPlayer.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const read = $derived(session.read)
</script>

<div class="empty">
  {#if read.kind === 'syntax'}
    <h2>This scene's file has a mistake{read.line === undefined ? '' : ` on line ${String(read.line)}`}.</h2>
    <p>It opens read only until the mistake is fixed. Your file is unchanged.</p>
  {:else}
    <h2>This scene has no characters yet.</h2>
    <p>A character is an enemy or a friend that walks, notices the player and decides what to do.</p>
    {#if !session.facts.hasPlayer}<NoPlayer editor="schematic" />{/if}
    {#if session.places === undefined || Object.keys(session.places.nodes).length === 0}
      <p>A character walks between places, so add the places first. One added now has nowhere to walk and stands in the corner.</p>
      <Button onclick={() => (session.chosen = { kind: 'places' })}>Add the first place</Button>
    {/if}
    <Button onclick={() => void session.addCharacter()}>Add a character</Button>
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
</style>
