<!--
  The Tiles view's details in the suite's shell: the selected rule or group. Only once the game has tiles: before that
  there is no rule to choose or add, and an inspector saying so is a panel of nothing (build audit G2).
-->
<script lang="ts">
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import RuleInspector from './RuleInspector.svelte'
import { tileImages, tilesState } from './tiles-state.svelte'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  session: TilesetsSession
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
}

const { session, read, objectUrls }: Props = $props()

// svelte-ignore state_referenced_locally
const tiles = tilesState(session)
// svelte-ignore state_referenced_locally
const pictures = tileImages(() => tiles.project, read, objectUrls)
</script>

{#if tiles.project.defs.tilesets.length > 0}
  <RuleInspector
    project={tiles.project}
    selection={tiles.selection}
    {session}
    images={pictures.images}
    imageUrl={pictures.imageUrl}
  />
{/if}
