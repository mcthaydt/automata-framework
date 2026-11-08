<!--
  The Level view's inspector: the kit
  `Tabs` over Entity, Level and Checks. The default tab follows the selection (one or more selected: Entity; none:
  Level); a tab the person chose stays until the selection changes. The shell places it: a 320 px column in `wide`,
  a drawer in `medium`, a sheet in `compact`.
-->
<script lang="ts">
import Tabs from '../../shared/kit/widgets/Tabs.svelte'
import { entityInspector, levelChecks, levelInspector } from '../../shared/level-2d/editor/inspector-model'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import type { Project } from '../../shared/level-2d/model/project-types'
import type { Diagnostic } from '../../shared/level-2d/profiles/profile'
import ChecksTab from './ChecksTab.svelte'
import EntityTab from './EntityTab.svelte'
import LevelTab from './LevelTab.svelte'

interface Props {
  project: Project
  level: string
  selected: readonly string[]
  diagnostics: readonly Diagnostic[]
  history: EditHistory
  /** A Checks row was tapped: select the instance it is about. */
  onselect: (id: string) => void
  ondelete: () => void
  onduplicate: () => void
}

const { project, level, selected, diagnostics, history, onselect, ondelete, onduplicate }: Props = $props()

const entity = $derived(entityInspector(project, level, selected))
const levelInfo = $derived(levelInspector(project, level))
const checks = $derived(levelChecks(diagnostics, level))
/** The entity definitions' own colours, offered first by a colour field. */
const palette = $derived([
  ...new Set(
    project.defs.entities.flatMap((def) => (def.color?.startsWith('#') === true ? [def.color] : [])),
  ),
])

let chosen = $state.raw<{ readonly for: readonly string[]; readonly tab: string } | undefined>()
const tab = $derived(chosen?.for === selected ? chosen.tab : entity.kind === 'none' ? 'level' : 'entity')
const tabs = [
  { id: 'entity', label: 'Entity' },
  { id: 'level', label: 'Level' },
  { id: 'checks', label: 'Checks' },
]
</script>

<section class="inspector" aria-label="Inspector" data-testid="level-inspector">
  <Tabs label="Inspector" {tabs} value={tab} onselect={(id) => (chosen = { for: selected, tab: id })}>
    {#snippet panel(id)}
      {#if id === 'entity'}
        <EntityTab inspector={entity} {level} {history} {palette} {ondelete} {onduplicate} />
      {:else if id === 'level'}
        <LevelTab inspector={levelInfo} {history} {palette} />
      {:else}
        <ChecksTab name={levelInfo.name} rows={checks} {onselect} />
      {/if}
    {/snippet}
  </Tabs>
</section>

<style>
  .inspector {
    display: grid;
    align-content: start;
    min-width: 0;
  }
</style>
