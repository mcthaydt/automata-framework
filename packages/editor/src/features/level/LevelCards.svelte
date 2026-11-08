<!-- The Level view's dock (plan EDS.2d step 2): the level cards of the open level's world, from the session. -->
<script lang="ts">
import type { History } from '../../shared/kit/history/history'
import { levelCards } from './dock-model'
import LevelDock from './LevelDock.svelte'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
}

const { session, history }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)

const cards = $derived.by(() => {
  const open = level.view.level
  const world = level.project.worlds.find((each) =>
    each.placements.some((placement) => placement.level === open),
  )
  return world === undefined ? [] : levelCards(level.project, world.id, open)
})

function openLevel(id: string): void {
  session.editor.setLevel(id)
  session.fit()
}
</script>

<LevelDock {cards} onopen={openLevel} />
