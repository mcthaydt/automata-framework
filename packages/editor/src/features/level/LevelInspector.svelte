<!-- The Level view's inspector (what is chosen, or the level), drawn from the session. -->
<script lang="ts">
import type { History } from '../../shared/kit/history/history'
import type { IdSource } from '../../shared/level-2d/model/ids'
import Inspector from './Inspector.svelte'
import { levelActions } from './level-actions'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
  ids: IdSource
}

const { session, history, ids }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)
// svelte-ignore state_referenced_locally
const actions = levelActions(session, level.edits, ids)
</script>

<Inspector
  project={level.project}
  level={level.view.level}
  selected={level.view.selected}
  history={level.edits}
  ondelete={actions.deleteSelection}
  onduplicate={actions.duplicateSelection}
/>
