<!--
  The World view's inspector (plan ED2D.6b step 6): the selected level's name, its place (X, Y, depth), its size with
  the side it grows or shrinks from, and its typed fields. Each change is one undo step through `commitEdit`; a refused
  value shows its message and the field shows what the project holds. Resize applies at once when nothing is lost and
  asks first, listing the cells per layer, when painted cells would fall outside (spec §13).
-->
<script lang="ts">
import type { EditEvent } from '@mcthaydt/automata-editor-kit'
import { Button, Dialog, Segmented, Stepper } from '@mcthaydt/automata-editor-kit'
import type { Project, Size } from '../../model/project-types'
import { renameLevel } from '../../model/world/level-edits'
import { moveLevelInWorld, setLevelDepth } from '../../model/world/level-placement'
import { type AnchorSide, resizeLevel, resizeLevelLoss } from '../../model/world/level-resize'
import FieldEditor from '../level/FieldEditor.svelte'
import { commitEdit, commitField } from '../level/field-commit'
import { levelInspector } from '../level/inspector-model'
import type { EditHistory } from '../level-editor'

interface Props {
  project: Project
  level: string
  history: EditHistory
}

const { project, level, history }: Props = $props()

const found = $derived(project.levels.find((candidate) => candidate.id === level))
const placement = $derived(
  project.worlds.flatMap((world) => world.placements).find((candidate) => candidate.level === level),
)
const fields = $derived(levelInspector(project, level).fields)
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
  </div>
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
</style>
