<!--
  Levels 2D's place in the suite's top bar: the views (Level, Tiles) as quiet tabs and, in the Level view, the level
  picker; and where nothing keeps the level (the sample game, the site's try-it), Share, the bar's one primary action,
  with the toasts that say how it went. The suite owns Undo, Redo and the Panel and Details toggles.
-->
<script lang="ts">
import LevelPicker from '../../../features/level/LevelPicker.svelte'
import ShareMenu from '../../../features/share/ShareMenu.svelte'
import Segmented from '../../../shared/kit/widgets/Segmented.svelte'
import ToastRegion from '../../../shared/kit/widgets/ToastRegion.svelte'
import { createToasts } from '../../../shared/kit/widgets/toasts'
import type { Levels2dSession, Levels2dView } from './levels-2d-session'

interface Props {
  session: Levels2dSession
}

const { session }: Props = $props()

// svelte-ignore state_referenced_locally
const view = session.view
// svelte-ignore state_referenced_locally
const current = session.current
const toasts = createToasts()
const VIEWS: readonly { id: Levels2dView; label: string }[] = [
  { id: 'level', label: 'Level' },
  { id: 'tiles', label: 'Tiles' },
]
const choose = (id: string) => view.set(id === 'tiles' ? 'tiles' : 'level')
</script>

{#if $current.kind === 'open'}
  <Segmented label="Views" look="tabs" options={VIEWS} value={$view} onedit={(event) => choose(event.value)} />
  {#if $view === 'level'}
    <LevelPicker session={$current.level} history={$current.history} />
  {/if}
  {#if session.options.exports !== undefined}
    <ShareMenu canShare={session.options.exports.canShare} share={(action) => session.share(action)} {toasts} />
  {/if}
{/if}
<ToastRegion {toasts} />
