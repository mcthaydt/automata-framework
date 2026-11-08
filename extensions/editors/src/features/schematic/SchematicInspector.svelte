<!-- Schematic's inspector: the mode or the switch selected on the diagram or the list. -->
<script lang="ts">
import CharacterInspector from './CharacterInspector.svelte'
import ModeInspector from './ModeInspector.svelte'
import { sceneNames } from './names.ts'
import SwitchInspector from './SwitchInspector.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const character = $derived(session.character)
const agent = $derived(session.chosen.kind === 'character' ? session.chosen.index : 0)
const names = $derived(sceneNames(session, agent))
const selected = $derived(session.selected)
</script>

{#if character !== undefined && names !== undefined}
  {#if selected?.kind === 'mode'}
    <ModeInspector {session} {agent} {character} mode={selected.mode} {names} />
  {:else if selected?.kind === 'switch'}
    <SwitchInspector {session} {agent} {character} index={selected.index} {names} />
  {:else}
    <CharacterInspector {session} {agent} {character} {names} />
  {/if}
{/if}
