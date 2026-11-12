<!--
  One inspector row: the kit control a field's
  type maps to (`inspector-model.ts`). A stepper, toggle, segmented control or picker commits on change; text commits
  on blur or Enter, and Escape puts it back. `oncommit` is `commitField` bound to the field: when it refuses, the
  message shows under the field and the control is rebuilt from the stored value (`revision`), so what the field shows
  is always what the project holds. A `ref` shows its target's name and, where the row knows the project, picks a new
  one in `RefPicker`.
-->
<script lang="ts">
import type { FieldValue, Point, RefValue } from '@automata/content/level-2d'
import Field from '../rows/Field.svelte'
import Button from '../widgets/Button.svelte'
import ColorField from '../widgets/ColorField.svelte'
import type { EditEvent } from '../widgets/edit-event'
import Picker from '../widgets/Picker.svelte'
import Segmented from '../widgets/Segmented.svelte'
import Stepper from '../widgets/Stepper.svelte'
import type { FieldCommit, FieldRow } from './field-row'
import RefPicker from './RefPicker.svelte'

interface Props {
  row: FieldRow
  /** The colours a colour field offers first. */
  palette: readonly string[]
  oncommit: (value: FieldValue) => FieldCommit
}

const { row, palette, oncommit }: Props = $props()

/** Controls that draw their own name: a stepper's is its scrub handle, a picker's and a colour's are in their buttons. */
const SELF_LABELLED: ReadonlySet<FieldRow['widget']> = new Set(['stepper', 'picker', 'color'])

let message = $state<string | undefined>()
let picking = $state(false)
/** Bumped on a refusal so the control remounts on the stored value. */
let revision = $state(0)

function commit(value: FieldValue): void {
  const result = oncommit(value)
  message = result.ok ? undefined : result.message
  if (!result.ok) revision++
}

const committed = (phase: EditEvent<unknown>['phase']): boolean => phase === 'set' || phase === 'commit'
const onNumber = (event: EditEvent<number>): void => {
  if (committed(event.phase)) commit(event.value)
}

const number = $derived(typeof row.value === 'number' ? row.value : 0)
const text = $derived(typeof row.value === 'string' ? row.value : '')
const point = $derived(isPoint(row.value) ? row.value : { x: 0, y: 0 })
const points = $derived(Array.isArray(row.value) ? row.value.filter(isPoint) : [])
const ref = $derived(isRef(row.value) ? row.value : undefined)

function isPoint(value: unknown): value is Point {
  return typeof value === 'object' && value !== null && 'x' in value && 'y' in value
}

function isRef(value: unknown): value is RefValue {
  return typeof value === 'object' && value !== null && 'target' in value
}

function setPoint(index: number, axis: 'x' | 'y', value: number): void {
  commit(points.map((each, i) => (i === index ? { ...each, [axis]: value } : each)))
}

function onTextKey(event: KeyboardEvent): void {
  const box = event.currentTarget as HTMLInputElement
  if (event.key === 'Enter' && row.widget === 'text') {
    event.preventDefault()
    if (box.value !== text) commit(box.value)
  } else if (event.key === 'Escape') {
    box.value = text
    message = undefined
  }
}

function onTextBlur(event: FocusEvent): void {
  const box = event.currentTarget as HTMLInputElement | HTMLTextAreaElement
  if (box.value !== text) commit(box.value)
}
</script>

<Field
  label={row.label}
  labelled={SELF_LABELLED.has(row.widget)}
  hint={row.hint}
  warning={row.widget === 'stepper' ? undefined : (message ?? row.missing)}
  data-widget={row.widget}
  data-field={row.id}
>
  {#key revision}
    {#if row.widget === 'stepper'}
      <Stepper
        label={row.label}
        value={number}
        min={row.bounds?.min}
        max={row.bounds?.max}
        step={row.bounds?.step ?? 1}
        integer={row.type === 'int'}
        unit={row.type === 'angle' ? '°' : undefined}
        error={message}
        onedit={onNumber}
      />
    {:else if row.widget === 'toggle'}
      <Segmented
        label={row.label}
        options={[
          { id: 'false', label: 'Off' },
          { id: 'true', label: 'On' },
        ]}
        value={row.value === true ? 'true' : 'false'}
        onedit={(event) => commit(event.value === 'true')}
      />
    {:else if row.widget === 'segmented'}
      <Segmented
        label={row.label}
        options={(row.options ?? []).map((option) => ({ id: option, label: option }))}
        value={text}
        onedit={(event) => commit(event.value)}
      />
    {:else if row.widget === 'picker'}
      <Picker
        label={row.label}
        options={(row.options ?? []).map((option) => ({ id: option, label: option }))}
        value={text}
        onpick={(id) => commit(id)}
      />
    {:else if row.widget === 'color'}
      <ColorField label={row.label} value={text} {palette} onedit={(event) => commit(event.value)} />
    {:else if row.widget === 'text' || row.widget === 'multiline'}
      {#if row.widget === 'text'}
        <input
          aria-label={row.label}
          class="text"
          type="text"
          value={text}
          onkeydown={onTextKey}
          onblur={onTextBlur}
        />
      {:else}
        <textarea
          aria-label={row.label}
          class="text"
          rows="3"
          value={text}
          onkeydown={onTextKey}
          onblur={onTextBlur}
        ></textarea>
      {/if}
    {:else if row.widget === 'point'}
      <div class="pair">
        <Stepper label={`${row.label} x`} value={point.x} onedit={(event) => committed(event.phase) && commit({ ...point, x: event.value })} />
        <Stepper label={`${row.label} y`} value={point.y} onedit={(event) => committed(event.phase) && commit({ ...point, y: event.value })} />
      </div>
    {:else if row.widget === 'points'}
      {#each points as each, index (index)}
        <div class="pair">
          <Stepper
            label={`${row.label} ${index + 1} x`}
            value={each.x}
            onedit={(event) => committed(event.phase) && setPoint(index, 'x', event.value)}
          />
          <Stepper
            label={`${row.label} ${index + 1} y`}
            value={each.y}
            onedit={(event) => committed(event.phase) && setPoint(index, 'y', event.value)}
          />
          <Button aria-label={`Remove ${row.label} ${index + 1}`} onclick={() => commit(points.filter((_, i) => i !== index))}
            >Remove</Button
          >
        </div>
      {/each}
      <Button
        aria-label={`Add point to ${row.label}`}
        onclick={() => commit([...points, points.at(-1) ?? { x: 0, y: 0 }])}>Add point</Button
      >
    {:else if row.widget === 'ref'}
      <div class="pair">
        <span class="value">{ref === undefined ? 'Not set' : (row.ref?.name ?? `${ref.target} (missing)`)}</span>
        {#if row.ref !== undefined}
          <Button onclick={() => (picking = true)}>Choose target</Button>
        {/if}
      </div>
      {#if row.ref !== undefined}
        <RefPicker bind:open={picking} name={row.label} targets={row.ref.targets} onchoose={commit} />
      {/if}
    {:else}
      <span class="value">{Array.isArray(row.value) ? `${row.value.length} items` : ''}</span>
    {/if}
  {/key}
</Field>

<style>
  .text {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-field);
    padding: 0 var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--bg);
    color: var(--ink);
    font: var(--text-body-13);
  }
  textarea.text {
    padding: var(--space-2);
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .value {
    color: var(--ink);
    font: var(--text-body-13);
  }
</style>
