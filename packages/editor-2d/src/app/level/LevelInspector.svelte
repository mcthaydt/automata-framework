<!-- The Level view's inspector (plan EDS.2d step 2): Entity, Level and Checks, drawn from the session. -->
<script lang="ts">
import type { History } from '@mcthaydt/automata-editor-kit/core'
import type { IdSource } from '../../model/ids'
import type { Project } from '../../model/project-types'
import type { Diagnostic } from '../../profiles/profile'
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
