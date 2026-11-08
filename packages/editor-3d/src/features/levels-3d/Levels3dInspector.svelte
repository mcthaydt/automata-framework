<!--
  The Levels 3D details in the suite (plan EDS.2d, 16.1): the card for what is selected, with its heights, light, wall kind
  and fields to change, the material and definitions sheets it opens, and how the level's checks stand. The same card
  the standalone frame drew, so a change here is one Undo step in the suite's top bar. Names sit left of their controls.
-->
<script lang="ts">
import type { LevelEditor } from '../../shared/edit/level-editor'
import type { ChecksPanel } from './checks/checks-panel-controller'
import DefinitionsSheet from './definitions/DefinitionsSheet.svelte'
import Inspector from './inspector/Inspector.svelte'
import { inspectorOf } from './inspector/inspector-cards'
import { createInspectorEdits } from './inspector/inspector-edits'
import MaterialSheet from './inspector/MaterialSheet.svelte'
import type { MaterialTarget } from './inspector/material-session'
import { checksWords } from './plan/plan-status'

const { editor, checks }: { editor: LevelEditor<unknown>; checks: ChecksPanel } = $props()

// svelte-ignore state_referenced_locally
const edits = createInspectorEdits(editor)
// svelte-ignore state_referenced_locally
let card = $state.raw(inspectorOf(editor))
// svelte-ignore state_referenced_locally
let counts = $state.raw(checks.view)
let materialTarget = $state<MaterialTarget | undefined>()
let definitionsOpen = $state(false)
$effect(() => {
  const stops = [
    editor.selection.subscribe(() => (card = inspectorOf(editor))),
    editor.history.subscribe(() => (card = inspectorOf(editor))),
    checks.subscribe(() => (counts = checks.view)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
})
</script>

<div class="details" aria-label="Level details" data-testid="levels-3d-details">
  <Inspector
    {card}
    onchange={(change, phase) => edits.change(change, phase)}
    onmaterial={(target) => (materialTarget = target)}
    ondefinitions={() => (definitionsOpen = true)}
  />
  <p class="checks">{checksWords(counts).text}</p>
</div>
{#if materialTarget !== undefined}
  <MaterialSheet {editor} surface={materialTarget} onclose={() => (materialTarget = undefined)} />
{/if}
{#if definitionsOpen}
  <DefinitionsSheet {editor} onclose={() => (definitionsOpen = false)} />
{/if}

<style>
  .details {
    /* Each name takes one column beside its control, as a settings list reads. */
    --label-flex: 0 0 7ch;
  }
  .checks {
    margin: 0;
    padding: 0 var(--space-4) var(--space-4);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
