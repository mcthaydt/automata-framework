<!--
  The definitions sheet (ED3D.13b; ED3D spec §5.4): a dialog with the definitions editor and, for a format whose materials
  are the file's own, the materials-table editor, in tabs. A format that fixes both says so and offers neither.
-->
<script lang="ts">
import { Button, Dialog, Tabs } from '@mcthaydt/automata-editor/kit'
import { onDestroy } from 'svelte'
import { createDefinitionsController, type DefinitionsView } from '../../app/definitions-controller'
import type { LevelEditor } from '../../model/level-editor'
import DefinitionsEditor from './DefinitionsEditor.svelte'
import MaterialsTable from './MaterialsTable.svelte'

interface Props {
  // biome-ignore lint/suspicious/noExplicitAny: the sheet works with any profile's level
  editor: LevelEditor<any>
  onclose: () => void
}

const { editor, onclose }: Props = $props()

// svelte-ignore state_referenced_locally
const controller = createDefinitionsController(editor)
let view = $state.raw<DefinitionsView>(controller.view)
const stop = controller.subscribe(() => {
  view = controller.view
})
onDestroy(() => {
  stop()
  controller.dispose()
})

let tab = $state('definitions')
const tabs = $derived([
  ...(view.definitions === undefined ? [] : [{ id: 'definitions', label: 'Definitions' }]),
  ...(view.materials === undefined ? [] : [{ id: 'materials', label: 'Materials' }]),
])
</script>

{#snippet body(id: string)}
  {#if view.definitions !== undefined && id === 'definitions'}
    <DefinitionsEditor
      rows={view.definitions}
      onadd={(definition) => controller.addDefinition(definition)}
      onrename={(id, to) => controller.renameDefinition(id, to)}
      onremove={(id) => controller.removeDefinition(id)}
      onaddfield={(def, field) => controller.addField(def, field)}
      onchangefield={(def, id, field) => controller.changeField(def, id, field)}
      onremovefield={(def, id) => controller.removeField(def, id)}
    />
  {:else if view.materials !== undefined && id === 'materials'}
    <MaterialsTable
      rows={view.materials}
      onadd={(id, material) => controller.addMaterial(id, material)}
      onchange={(id, material) => controller.changeMaterial(id, material)}
      onrename={(id, to) => controller.renameMaterial(id, to)}
      onremove={(id) => controller.removeMaterial(id)}
    />
  {/if}
{/snippet}

<Dialog open={true} title="Definitions" width="wide" {onclose}>
  {#if view.fixed !== undefined}
    <p role="status">{view.fixed}</p>
  {:else if tabs.length > 1}
    <Tabs label="Definitions sheet" {tabs} bind:value={tab} panel={body} />
  {:else if tabs[0] !== undefined}
    {@render body(tabs[0].id)}
  {/if}
  {#snippet actions({ close })}
    <Button onclick={close}>Done</Button>
  {/snippet}
</Dialog>
