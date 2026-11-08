<!--
  The inspector's Entity tab (plan ED2D.4c4b step 6, decision 2): nothing selected says how to select; several show
  their count with Delete and Duplicate only; one shows its definition, position, size (when resizable) and typed
  fields. Each change is one undo step through `commitEdit`; a refusal shows under the control that made it.
-->
<script lang="ts">
import FieldEditor from '../../shared/kit/fields/FieldEditor.svelte'
import Button from '../../shared/kit/widgets/Button.svelte'
import type { EditEvent } from '../../shared/kit/widgets/edit-event'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import { commitEdit, commitField } from '../../shared/level-2d/editor/field-commit'
import type { EntityInspector } from '../../shared/level-2d/editor/inspector-model'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor'
import { moveEntity, resizeEntity } from '../../shared/level-2d/model/commands/entity-edits'

interface Props {
  inspector: EntityInspector
  level: string
  history: EditHistory
  palette: readonly string[]
  ondelete: () => void
  onduplicate: () => void
}

const { inspector, level, history, palette, ondelete, onduplicate }: Props = $props()

let message = $state<string | undefined>()

const committed = (event: EditEvent<number>): boolean => event.phase === 'set' || event.phase === 'commit'

function place(axis: 'x' | 'y' | 'w' | 'h', event: EditEvent<number>): void {
  if (inspector.kind !== 'one' || !committed(event)) return
  const target = { level, layer: inspector.layer }
  const { id } = inspector.instance
  const { position, size } = inspector
  const result =
    axis === 'x' || axis === 'y'
      ? commitEdit(history, 'Move entity', (project) =>
          moveEntity(
            project,
            target,
            id,
            axis === 'x' ? event.value : position.x,
            axis === 'y' ? event.value : position.y,
          ),
        )
      : commitEdit(history, 'Resize entity', (project) =>
          resizeEntity(
            project,
            target,
            id,
            axis === 'w' ? event.value : (size?.w ?? 0),
            axis === 'h' ? event.value : (size?.h ?? 0),
          ),
        )
  message = result.ok ? undefined : result.message
}
</script>

<div class="tab" data-testid="entity-tab">
  {#if inspector.kind === 'none'}
    <p class="empty">{inspector.reason}</p>
  {:else if inspector.kind === 'many'}
    <p class="title">{inspector.count} selected</p>
    <div class="actions">
      <Button onclick={ondelete}>Delete</Button>
      <Button onclick={onduplicate}>Duplicate</Button>
    </div>
  {:else}
    <p class="title">{inspector.def.label ?? inspector.def.id}</p>
    <div class="pair" data-row="position">
      <Stepper label="X" value={inspector.position.x} integer onedit={(event) => place('x', event)} />
      <Stepper label="Y" value={inspector.position.y} integer onedit={(event) => place('y', event)} />
    </div>
    {#if inspector.size !== undefined}
      <div class="pair">
        <Stepper label="Width" value={inspector.size.w} min={1} integer onedit={(event) => place('w', event)} />
        <Stepper label="Height" value={inspector.size.h} min={1} integer onedit={(event) => place('h', event)} />
      </div>
    {/if}
    {#if message}<p class="message" role="alert">{message}</p>{/if}
    {#each inspector.fields as row (row.id)}
      <FieldEditor
        {row}
        {palette}
        oncommit={(value) =>
          commitField(history, { kind: 'entity', level, layer: inspector.layer, id: inspector.instance.id }, row.id, value)}
      />
    {/each}
    <div class="actions">
      <Button onclick={ondelete}>Delete</Button>
      <Button onclick={onduplicate}>Duplicate</Button>
    </div>
  {/if}
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
  .empty,
  .message {
    margin: 0;
    font: var(--text-body-13);
  }
  .empty {
    color: var(--color-text-dim);
  }
  .message {
    color: var(--color-state-bad);
  }
  .pair,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
