<!--
  What the inspector shows with nothing chosen: the level's name as the heading, its size beneath, and its typed
  fields, label-left, each change one undo step. Renaming and resizing a level are the World view's, where a resize that loses cells is confirmed.
-->
<script lang="ts">
import FieldEditor from '../../shared/kit/fields/FieldEditor.svelte'
import type { LevelInspector } from '../../shared/level-2d/documents/inspector-model'
import type { EditHistory } from '../../shared/level-2d/model/edit-history'
import { commitField } from '../../shared/level-2d/model/field-commit'

interface Props {
  inspector: LevelInspector
  history: EditHistory
  palette: readonly string[]
}

const { inspector, history, palette }: Props = $props()
</script>

<div class="tab" data-testid="level-tab">
  <h2 class="title">{inspector.name}</h2>
  <p class="size">{inspector.size.w} × {inspector.size.h} px</p>
  {#each inspector.fields as row (row.id)}
    <FieldEditor
      {row}
      {palette}
      oncommit={(value) => commitField(history, { kind: 'level', level: inspector.id }, row.id, value)}
    />
  {:else}
    <p class="size">This level has no settings.</p>
  {/each}
</div>

<style>
  .tab {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    min-width: 0;
  }
  .title {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  .size {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
