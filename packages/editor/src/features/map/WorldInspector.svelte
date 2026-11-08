<!--
  The World view's inspector: the selected level's name, its place (X, Y, depth), its size with
  the side it grows or shrinks from, and its typed fields. Each change is one undo step through `commitEdit`; a refused
  value shows its message and the field shows what the project holds. Below the fields, the level's links and the levels
  that link to it, then Duplicate and Remove: Remove asks first, saying how
  many links from other levels will break, and is off on a project's last level. Resize applies at once when nothing is lost and
  asks first, listing the cells per layer, when painted cells would fall outside.
-->
<script lang="ts">
import FieldEditor from '../../shared/kit/fields/FieldEditor.svelte'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { EditEvent } from '../../shared/kit/widgets/edit-event'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import { commitEdit, commitField } from '../../shared/level-2d/editor/field-commit'
import { levelInspector } from '../../shared/level-2d/editor/inspector-model'
import type { EditHistory } from '../../shared/level-2d/editor/level-editor-api'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { Project, Size } from '../../shared/level-2d/model/project-types'
import { duplicateLevel, removeLevel, renameLevel } from '../../shared/level-2d/model/world/level-edits'
import { moveLevelInWorld, setLevelDepth } from '../../shared/level-2d/model/world/level-placement'
import { type AnchorSide, resizeLevel, resizeLevelLoss } from '../../shared/level-2d/model/world/level-resize'
import { levelLinks } from '../../shared/level-2d/model/world/world-links'
import { copyLevelInput, linksInto } from '../../shared/level-2d/model/world/world-model'

interface Props {
  project: Project
  level: string
  history: EditHistory
  ids: IdSource
  /** A level was added (a duplicate): the view selects it and fits the map. */
  onadded: (level: string) => void
  /** The level was removed: the view clears the selection. */
  onremoved: () => void
}

const { project, level, history, ids, onadded, onremoved }: Props = $props()

const found = $derived(project.levels.find((candidate) => candidate.id === level))
const placement = $derived(
  project.worlds.flatMap((world) => world.placements).find((candidate) => candidate.level === level),
)
const fields = $derived(levelInspector(project, level).fields)
const linked = $derived(levelLinks(project, level))
const breaking = $derived(linksInto(project, level))
let removing = $state(false)

function duplicate(): void {
  const copy = copyLevelInput(project, level)
  const result = commitEdit(history, 'Duplicate level', (current) =>
    duplicateLevel(current, level, copy, ids),
  )
  if (result.ok) onadded(copy.id)
  else message = result.message
}

function remove(): void {
  const result = commitEdit(history, 'Remove level', (current) => removeLevel(current, level))
  if (result.ok) onremoved()
  else message = result.message
}
const palette = $derived([
  ...new Set(
    project.defs.entities.flatMap((def) => (def.color?.startsWith('#') === true ? [def.color] : [])),
  ),
])

let message = $state<string | undefined>()
let name = $state('')
let size = $state<Size>({ w: 0, h: 0 })
let across = $state<AnchorSide>('start')
let down = $state<AnchorSide>('start')
let confirming = $state(false)

// The name and the size being typed start again from the project whenever the level or its stored values change.
$effect(() => {
  name = found?.name ?? ''
})
$effect(() => {
  size = { ...(found?.size ?? { w: 0, h: 0 }) }
})

const committed = (event: EditEvent<number>): boolean => event.phase === 'set' || event.phase === 'commit'
const anchor = $derived({ x: across, y: down })
const loss = $derived(confirming ? resizeLevelLoss(project, level, size, anchor) : [])
const layerLabel = (id: string): string => project.defs.layers.find((def) => def.id === id)?.label ?? id

function edit(label: string, update: (current: Project) => Project): void {
  const result = commitEdit(history, label, update)
  message = result.ok ? undefined : result.message
}

function rename(): void {
  edit('Rename level', (current) => renameLevel(current, level, name))
  if (message !== undefined) name = found?.name ?? ''
}

function place(axis: 'x' | 'y', event: EditEvent<number>): void {
  if (!committed(event) || placement === undefined) return
  const { x, y } = placement
  edit('Move level', (current) =>
    moveLevelInWorld(current, level, axis === 'x' ? event.value : x, axis === 'y' ? event.value : y),
  )
}

function resize(confirmed: boolean): void {
  if (!confirmed) {
    let lost: readonly unknown[]
    try {
      lost = resizeLevelLoss(project, level, size, anchor)
    } catch (error) {
      message = error instanceof RangeError ? error.message : String(error)
      return
    }
    if (lost.length > 0) {
      confirming = true
      return
    }
  }
  confirming = false
  edit('Resize level', (current) => resizeLevel(current, level, size, anchor))
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`
</script>

{#if found !== undefined && placement !== undefined}
  <div class="inspector" data-testid="world-inspector">
    <label class="name">
      <span>Name</span>
      <input
        type="text"
        bind:value={name}
        onchange={rename}
        onkeydown={(event) => {
          if (event.key === 'Enter') rename()
        }}
      />
    </label>
    {#if message !== undefined}<p class="message" role="alert">{message}</p>{/if}
      <Stepper label="X" value={placement.x} integer onedit={(event) => place('x', event)} />
      <Stepper label="Y" value={placement.y} integer onedit={(event) => place('y', event)} />
    <Stepper
      label="Depth"
      value={placement.depth}
      integer
      onedit={(event) => {
        if (committed(event)) edit('Set depth', (current) => setLevelDepth(current, level, event.value))
      }}
    />
      <Stepper
        label="Width"
        value={size.w}
        min={1}
        integer
        onedit={(event) => {
          if (committed(event)) size = { ...size, w: event.value }
        }}
      />
      <Stepper
        label="Height"
        value={size.h}
        min={1}
        integer
        onedit={(event) => {
          if (committed(event)) size = { ...size, h: event.value }
        }}
      />
    <Segmented
      label="Keep the side"
      options={[
        { id: 'start', label: 'Left' },
        { id: 'centre', label: 'Centre' },
        { id: 'end', label: 'Right' },
      ]}
      bind:value={across}
    />
    <Segmented
      label="Keep the edge"
      options={[
        { id: 'start', label: 'Top' },
        { id: 'centre', label: 'Middle' },
        { id: 'end', label: 'Bottom' },
      ]}
      bind:value={down}
    />
    <Button
      disabled={size.w === found.size.w && size.h === found.size.h}
      onclick={() => resize(false)}>Resize</Button
    >
    {#each fields as row (row.id)}
      <FieldEditor
        {row}
        {palette}
        oncommit={(value) => commitField(history, { kind: 'level', level }, row.id, value)}
      />
    {/each}
    <h3 class="eyebrow">Links</h3>
    {#if linked.out.length === 0}
      <p class="quiet">No links from this level.</p>
    {:else}
      <ul class="links" aria-label="Links">
        {#each linked.out as link, index (index)}
          <li>{`${link.label} → ${link.to}`}</li>
        {/each}
      </ul>
    {/if}
    <p class="quiet">{linked.from.length === 0 ? 'Nothing links to this level.' : `Linked from: ${linked.from.join(', ')}`}</p>
    <div class="actions">
      <Button onclick={duplicate}>Duplicate</Button>
      <Button variant="danger" disabled={project.levels.length <= 1} onclick={() => (removing = true)}>Remove</Button>
    </div>
  </div>
  <Dialog open={removing} title={`Remove ${found.name}?`} onclose={() => (removing = false)}>
    <p>
      {breaking === 0
        ? 'Nothing links here from another level.'
        : breaking === 1
          ? '1 link leads here. It will show in Checks as broken.'
          : `${breaking} links lead here. They will show in Checks as broken.`}
    </p>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      <Button
        variant="danger"
        onclick={() => {
          close()
          remove()
        }}>Remove</Button
      >
    {/snippet}
  </Dialog>
  <Dialog open={confirming} title={`Resize ${found.name}?`} onclose={() => (confirming = false)}>
    <p>These cells fall outside the new size and are dropped:</p>
    <ul>
      {#each loss as dropped (dropped.layer)}
        <li>{`${layerLabel(dropped.layer)}: ${plural(dropped.count, 'cell')}`}</li>
      {/each}
    </ul>
    {#snippet actions({ close })}
      <Button onclick={close}>Cancel</Button>
      <Button
        variant="danger"
        onclick={() => {
          close()
          resize(true)
        }}>Resize anyway</Button
      >
    {/snippet}
  </Dialog>
{/if}

<style>
  .inspector {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
  }
  .name {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .name input {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .message {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
  .eyebrow {
    margin: var(--space-2) 0 0;
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    text-transform: uppercase;
  }
  .links {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .links li {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-mono-12);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .quiet {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
</style>
