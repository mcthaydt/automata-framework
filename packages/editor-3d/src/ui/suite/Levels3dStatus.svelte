<!-- The Levels 3D status line (plan EDS.2d): the file, where the pointer is, the zoom, the selection, and a refusal. -->
<script lang="ts">
import { planZoom } from '../../app/plan-picture'
import { planStatus } from '../../app/plan-status'
import type { Levels3dSuiteSession } from './levels-3d-suite-editor'
import { pointerOf } from './pointer.svelte'

const { session }: { session: Levels3dSuiteSession } = $props()

// svelte-ignore state_referenced_locally
const { level } = session
// svelte-ignore state_referenced_locally
const pointer = pointerOf(session)
const editor = level.state.kind === 'open' ? level.state.editor : undefined
let zoom = $state(editor === undefined ? 0 : planZoom(editor.view.state.camera))
let selection = $state.raw<readonly string[]>(editor?.selection.ids ?? [])
// A refused step is taken back, so the history's change is when the refusal is new.
let refusal = $state(level.refusal)

$effect(() => {
  if (editor === undefined) return
  const stops = [
    editor.view.subscribe((state) => (zoom = planZoom(state.camera))),
    editor.selection.subscribe((next) => (selection = next.ids)),
    editor.history.subscribe(() => (refusal = level.refusal)),
  ]
  return () => {
    for (const stop of stops) stop()
  }
})

const words = $derived(
  editor === undefined ? '' : planStatus({ pointer: pointer.at, pxPerMetre: zoom, selection }),
)
</script>

<p class="status">
  <span>{level.path}</span>
  {#if words !== ''}<span>{words}</span>{/if}
  {#if level.others.length > 0}<span>{level.others.length} more in this group</span>{/if}
  {#if refusal !== undefined}<span role="alert">Not saved: {refusal}</span>{/if}
</p>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    font: var(--text-body-13);
    color: var(--color-text-dim);
  }
</style>
