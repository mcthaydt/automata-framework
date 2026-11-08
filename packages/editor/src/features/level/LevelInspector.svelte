<!-- The Level view's inspector: Entity, Level and Checks, drawn from the session. -->
<script lang="ts">
import type { History } from '../../shared/kit/history/history'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { Diagnostic } from '../../shared/level-2d/profiles/profile'
import Inspector from './Inspector.svelte'
import { levelActions } from './level-actions'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
  ids: IdSource
  /** The document profile's checks over the project. */
  check: (project: Project) => readonly Diagnostic[]
}

const { session, history, ids, check }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)
// svelte-ignore state_referenced_locally
const actions = levelActions(session, level.edits, ids)
const diagnostics = $derived(check(level.project))
</script>

<Inspector
  project={level.project}
  level={level.view.level}
  selected={level.view.selected}
  {diagnostics}
  history={level.edits}
  onselect={(id) => session.editor.select([id])}
  ondelete={actions.deleteSelection}
  onduplicate={actions.duplicateSelection}
/>
