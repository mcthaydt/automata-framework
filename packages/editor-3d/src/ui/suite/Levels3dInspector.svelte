<!-- The Levels 3D inspector in the suite (plan EDS.2d): what is selected, and how the level's checks stand. -->
<script lang="ts">
import type { ChecksPanel } from '../../app/checks-panel-controller'
import { checksWords, planStatus } from '../../app/plan-status'
import type { LevelEditor } from '../../model/level-editor'
import ChecksList from '../checks/ChecksList.svelte'

const { editor, checks }: { editor: LevelEditor<unknown>; checks: ChecksPanel } = $props()

// svelte-ignore state_referenced_locally
let selection = $state.raw<readonly string[]>(editor.selection.ids)
// svelte-ignore state_referenced_locally
let counts = $state.raw(checks.view)
$effect(() => {
  const stops = [
    editor.selection.subscribe((next) => (selection = next.ids)),
    checks.subscribe(() => (counts = checks.view)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
})
</script>

<section class="inspector" aria-label="Level details">
  <h2>Selected</h2>
  <p data-testid="levels-3d-selection">{planStatus({ pointer: undefined, pxPerMetre: 0, selection, brief: true })}</p>
  <h2>Checks</h2>
  <p>{checksWords(counts).text}</p>
  <ChecksList {checks} clean={false} />
</section>

<style>
  .inspector {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    font: var(--text-body-13);
    color: var(--color-text-primary);
  }
  .inspector h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  .inspector p {
    margin: 0;
  }
</style>
