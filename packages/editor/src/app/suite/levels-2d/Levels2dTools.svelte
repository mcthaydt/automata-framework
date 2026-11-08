<!--
  Levels 2D's place in the suite's top bar: the views (Level, Tiles, Characters) as quiet tabs and, in the Level
  view the level picker. The suite owns Undo, Redo and the Panel and Details toggles.
-->
<script lang="ts">
import LevelPicker from '../../../features/level/LevelPicker.svelte'
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
const choose = (id: string) => view.set(id === 'tiles' || id === 'characters' ? id : 'level')
</script>

{#if session.state.kind === 'open'}
  <Segmented label="Views" look="tabs" options={VIEWS} value={$view} onedit={(event) => choose(event.value)} />
  {#if $view === 'level'}
    <LevelPicker session={session.state.level} history={session.state.history} />
  {/if}
{/if}
