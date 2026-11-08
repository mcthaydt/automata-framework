<!--
  The Characters view's details in the editor suite's shell: the selected character's look, shape and fields.
-->
<script lang="ts">
import { charactersState } from './characters-state.svelte'
import EntityInspector from './EntityInspector.svelte'
import type { EntitiesSession } from './entities-session'

const { session }: { session: EntitiesSession } = $props()

// svelte-ignore state_referenced_locally
const state = charactersState(session)
</script>

<EntityInspector project={state.project} selection={state.selection} {session} />
