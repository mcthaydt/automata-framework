<!-- Schematic's inspector: the mode or the switch selected on the diagram or the list. -->
<script lang="ts">
import ModeInspector from './ModeInspector.svelte'
import { namesOf } from './names.ts'
import SwitchInspector from './SwitchInspector.svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const character = $derived(session.character)
const agent = $derived(session.chosen.kind === 'character' ? session.chosen.index : 0)
const names = $derived(
  session.def === undefined
    ? undefined
    : namesOf(session.def, agent, Object.keys(session.places?.nodes ?? {})),
)
const selected = $derived(session.selected)
</script>

{#if character !== undefined && names !== undefined}
  {#if selected?.kind === 'mode'}
    <ModeInspector {session} {agent} {character} mode={selected.mode} {names} />
  {:else if selected?.kind === 'switch'}
    <SwitchInspector {session} {agent} {character} index={selected.index} {names} />
  {:else}
    <p class="hint">Choose a mode or an arrow to change it.</p>
  {/if}
{/if}

<style>
  .hint {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
