<!--
  The room's views as one control (spec 10.3): Plan, 3D and Walk as three segments where there is room, and as one menu
  button that names the view it shows where there is not (a phone). It sets the level editor's view mode, so the
  choice is kept with the camera and layer. Split needs a wide screen the control does not assume.
-->
<script lang="ts">
import { Menu, Segmented } from '@automata/editor/kit'
import type { LevelEditor } from '../../shared/edit/level-editor'
import { modeOptions } from './plan/plan-status'

const { editor, compact }: { editor: LevelEditor<unknown>; compact: boolean } = $props()

// svelte-ignore state_referenced_locally
let mode = $state(editor.view.state.mode)
$effect(() => editor.view.subscribe((state) => (mode = state.mode)))

const views = modeOptions({ narrow: true })
const shown = $derived(mode === 'split' ? 'dollhouse' : mode)
const choose = (id: string): void => editor.view.set({ mode: id as typeof mode })
</script>

{#snippet viewName()}{views.find((view) => view.id === shown)?.label ?? 'Plan'}{/snippet}

{#if compact}
  <Menu
    label="View"
    items={views.map((view) => ({
      id: view.id,
      label: view.label,
      detail: view.id === shown ? 'Showing' : undefined,
    }))}
    trigger={viewName}
    onselect={choose}
  />
{:else}
  <Segmented label="View" options={views} value={shown} onedit={(event) => choose(event.value)} />
{/if}
