<!-- The Tiles view's panel in the suite's shell: the tilesets, auto layers, rule groups and rules. -->
<script lang="ts">
import type { ObjectUrls } from '../../shared/level-2d/documents/view-props'
import TilesetsPanel from './TilesetsPanel.svelte'
import { tileImages, tilesState } from './tiles-state.svelte'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  session: TilesetsSession
  read: (path: string) => Promise<Uint8Array | undefined>
  objectUrls?: ObjectUrls | undefined
  /** Opens Add tiles; absent where nothing can be written, and then there is no button. */
  onaddtiles?: (() => void) | undefined
}

const { session, read, objectUrls, onaddtiles }: Props = $props()

// svelte-ignore state_referenced_locally
const tiles = tilesState(session)
// svelte-ignore state_referenced_locally
const pictures = tileImages(() => tiles.project, read, objectUrls)
</script>

<TilesetsPanel
  project={tiles.project}
  selection={tiles.selection}
  {session}
  images={pictures.images}
  imageUrl={pictures.imageUrl}
  {onaddtiles}
/>
