<!--
  The Characters view's panel in the editor suite's shell: the list of characters and the settings every level has.
-->
<script lang="ts">
import { charactersState } from './characters-state.svelte'
import EntitiesPanel from './EntitiesPanel.svelte'
import type { EntitiesSession } from './entities-session'

const { session }: { session: EntitiesSession } = $props()

// svelte-ignore state_referenced_locally
const state = charactersState(session)
</script>

<EntitiesPanel project={state.project} selection={state.selection} {session} />
