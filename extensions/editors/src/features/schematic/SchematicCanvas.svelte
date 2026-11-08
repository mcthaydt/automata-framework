<!-- Schematic's canvas: the start page when there is nothing to edit, else what the panel chose. -->
<script lang="ts">
import EditorPage from '../../shared/ui/EditorPage.svelte'
import CharacterCanvas from './CharacterCanvas.svelte'
import SchematicStart from './SchematicStart.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const character = $derived(session.character)
const ready = $derived(session.facts.usesSystems && session.def !== undefined)
</script>

<EditorPage label="Schematic">
  {#if session.message !== undefined}
    <p class="refused" role="alert">{session.message}</p>
  {/if}
  {#if !ready}
    <SchematicStart {session} />
  {:else if character !== undefined}
    <CharacterCanvas {session} />
  {:else if (session.def?.agents.length ?? 0) === 0}
    <SchematicStart {session} />
  {/if}
</EditorPage>

<style>
  .refused {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
