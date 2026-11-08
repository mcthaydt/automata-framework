<!--
  Levels 2D's place in the suite's top bar: the views (Level, Tiles, Characters) as quiet tabs and, in the Level
  view the level picker. On the try-it sample, Share is the bar's one primary action: the level has no game folder to
  be saved into, so this is how it leaves. The suite owns Undo, Redo and the Panel and Details toggles.
-->
<script lang="ts">
import LevelPicker from '../../../features/level/LevelPicker.svelte'
import { type ShareAction, shareItems } from '../../../features/share/share-model'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import Segmented from '../../../shared/kit/widgets/Segmented.svelte'
import type { Levels2dSession, Levels2dView } from './levels-2d-session'

interface Props {
  session: Levels2dSession
}

const { session }: Props = $props()

// svelte-ignore state_referenced_locally
const view = session.view
const VIEWS: readonly { id: Levels2dView; label: string }[] = [
  { id: 'level', label: 'Level' },
  { id: 'tiles', label: 'Tiles' },
  { id: 'characters', label: 'Characters' },
]
// svelte-ignore state_referenced_locally
const current = session.current
const choose = (id: string) => view.set(id === 'tiles' || id === 'characters' ? id : 'level')
</script>

{#if $current.kind === 'open'}
  <Segmented label="Views" look="tabs" options={VIEWS} value={$view} onedit={(event) => choose(event.value)} />
  {#if $view === 'level'}
    <LevelPicker session={$current.level} history={$current.history} />
  {/if}
  {#if session.share !== undefined}
    <Menu
      label="Share"
      items={shareItems(session.options.share?.canShare ?? false)}
      onselect={(action) => void session.share?.(action as ShareAction)}
    >
      {#snippet trigger()}<Icon name="share" size={16} />Share{/snippet}
    </Menu>
  {/if}
{/if}
