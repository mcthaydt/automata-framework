<!--
  The layers list over a level editor (plan EDS.2d step 5, split out of `DocumentFrame.svelte`): its rows follow the
  editor's history and view, so the standalone frame and the editor suite's panel draw the same list from an editor
  that outlives them.
-->
<script lang="ts">
import { editorLayerRows, type LayerRow } from '../../app/layers-model'
import type { LevelEditor } from '../../model/level-editor'
import LayersPanel from './LayersPanel.svelte'

const { editor }: { editor: LevelEditor<unknown> } = $props()

// svelte-ignore state_referenced_locally
let rows = $state.raw<readonly LayerRow[]>(editorLayerRows(editor))
$effect(() => {
  const read = () => (rows = editorLayerRows(editor))
  const stops = [editor.history.subscribe(read), editor.view.subscribe(read)]
  return () => {
    for (const stop of stops) stop()
  }
})
</script>

<LayersPanel
  {rows}
  ontoggle={(list, layer) => editor.view.toggle(list, layer)}
  onactivate={(layer) => editor.view.set({ layer })}
/>
