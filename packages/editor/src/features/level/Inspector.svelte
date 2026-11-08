<!--
  The Level view's inspector, as the approved mockup draws it: no tabs. It shows what is chosen (one instance's
  fields, or several's count with Delete and Duplicate) and, with nothing chosen, the level itself, so it is never
  an empty panel asking to be filled. Problems are not here: they live in the top bar, where they are seen from every
  view. The fields read label-left: the inspector sets `--label-flex`, `--label-columns` and `--label-control-column`, which the kit's
  Stepper, ColorField and FieldEditor read, so every name sits in one column beside its control. The shell places it:
  a column in `wide`, a drawer in `medium`, a sheet in `compact`.
-->
<script lang="ts">
import { entityInspector, levelInspector } from '../../shared/level-2d/editor/inspector-model'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import type { Project } from '../../shared/level-2d/model/project-types'
import EntityTab from './EntityTab.svelte'
import LevelTab from './LevelTab.svelte'

interface Props {
  project: Project
  level: string
  selected: readonly string[]
  history: EditHistory
  ondelete: () => void
  onduplicate: () => void
}

const { project, level, selected, history, ondelete, onduplicate }: Props = $props()

const entity = $derived(entityInspector(project, level, selected))
/** The entity definitions' own colours, offered first by a colour field. */
const palette = $derived([
  ...new Set(
    project.defs.entities.flatMap((def) => (def.color?.startsWith('#') === true ? [def.color] : [])),
  ),
])
</script>

<section class="inspector" aria-label="Inspector" data-testid="level-inspector" data-labels="left">
  {#if entity.kind === 'none'}
    <LevelTab inspector={levelInspector(project, level)} {history} {palette} />
  {:else}
    <EntityTab inspector={entity} {level} {history} {palette} {ondelete} {onduplicate} />
  {/if}
</section>

<style>
  /* The label column every field lines up on (the mockup's 72 px, a little wider so "Hit points" fits). */
  .inspector {
    --label-width: 5.5rem;
    --label-flex: 0 0 var(--label-width);
    --label-columns: var(--label-width) minmax(0, 1fr);
    --label-control-column: 2;
    display: grid;
    align-content: start;
    min-width: 0;
  }
</style>
