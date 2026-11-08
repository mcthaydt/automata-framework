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

// The scene's other pages are edited on the page itself; the inspector says so rather than sitting empty.
const ELSEWHERE: Readonly<Record<string, string>> = {
  places: 'Open a place on the page to rename it, move it or join it to another.',
  rules: 'Rules are changed on the page, one under another.',
  numbers: 'Numbers are changed on the page.',
  fair: 'Fair play is read and changed on the page.',
  puzzle: 'The puzzle is changed on the page.',
}
</script>

{#if character !== undefined && names !== undefined}
  {#if selected?.kind === 'mode'}
    <ModeInspector {session} {agent} {character} mode={selected.mode} {names} />
  {:else if selected?.kind === 'switch'}
    <SwitchInspector {session} {agent} {character} index={selected.index} {names} />
  {:else}
    <CharacterInspector {session} {agent} {character} {names} />
  {/if}
{:else if ELSEWHERE[session.chosen.kind] !== undefined}
  <p class="dim">{ELSEWHERE[session.chosen.kind]}</p>
{/if}

<style>
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
