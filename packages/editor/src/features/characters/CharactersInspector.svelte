<!--
  The Characters view's details in the editor suite's shell: the selected character's look, shape and fields.
-->
<script lang="ts">
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import { charactersState } from './characters-state.svelte'
import EntityInspector from './EntityInspector.svelte'
import type { EntitiesSession } from './entities-session'

interface Props {
  session: EntitiesSession
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
  files?: Pick<ProjectStore, 'list' | 'write'> | undefined
}

const { session, read, objectUrls, files }: Props = $props()

// svelte-ignore state_referenced_locally
const state = charactersState(session)
</script>

<EntityInspector project={state.project} selection={state.selection} {session} {read} {objectUrls} {files} />
