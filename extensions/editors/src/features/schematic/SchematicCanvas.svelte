<!-- Schematic's canvas: the start page when there is nothing to edit, else what the panel chose. -->
<script lang="ts">
import EditorPage from '../../shared/ui/EditorPage.svelte'
import CharacterCanvas from './CharacterCanvas.svelte'
import FairCanvas from './FairCanvas.svelte'
import NumbersCanvas from './NumbersCanvas.svelte'
import PlacesCanvas from './PlacesCanvas.svelte'
import PuzzleCanvas from './PuzzleCanvas.svelte'
import RulesCanvas from './RulesCanvas.svelte'
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
  {#if session.facts.usesSystems && session.chosen.kind === 'places' && session.read.kind !== 'syntax'}
    <!-- A new game has no characters yet, but its places can be laid out first. -->
    <PlacesCanvas {session} />
  {:else if !ready}
    <SchematicStart {session} />
  {:else if session.chosen.kind === 'rules'}
    <RulesCanvas {session} />
  {:else if session.chosen.kind === 'puzzle'}
    <PuzzleCanvas {session} />
  {:else if session.chosen.kind === 'fair'}
    <FairCanvas {session} />
  {:else if session.chosen.kind === 'numbers'}
    <NumbersCanvas {session} />
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
