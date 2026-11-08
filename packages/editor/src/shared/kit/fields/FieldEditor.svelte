<!--
  One inspector row: the kit control a field's
  type maps to (`inspector-model.ts`). A stepper, toggle, segmented control or picker commits on change; text commits
  half a second after the last key, on leaving and on Enter, and Escape puts it back. `oncommit` is `commitField` bound to the field: when it refuses, the
  message shows under the field and the control is rebuilt from the stored value (`revision`), so what the field shows
  is always what the project holds. A `ref` shows its target's name and, where the row knows the project, picks a new
  one in `RefPicker`.
-->
<script lang="ts">
import type { FieldValue, Point, RefValue } from '@automata/content/level-2d'
import Button from '../widgets/Button.svelte'
import ColorField from '../widgets/ColorField.svelte'
import type { EditEvent } from '../widgets/edit-event'
import Picker from '../widgets/Picker.svelte'
import Segmented from '../widgets/Segmented.svelte'
import Stepper from '../widgets/Stepper.svelte'
import { typedSave } from '../widgets/typed-save'
import { typingDrafts } from '../widgets/typing-context'
import type { FieldCommit, FieldRow } from './field-row'
import RefPicker from './RefPicker.svelte'

interface Props {
  row: FieldRow
  /** The colours a colour field offers first. */
  palette: readonly string[]
  oncommit: (value: FieldValue) => FieldCommit
}

const { row, palette, oncommit }: Props = $props()

const uid = $props.id()
const drafts = typingDrafts()
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

/**
 * Writes typed text. A refusal shows, and the control is rebuilt from the stored value, only once the person has left
 * the field; while they type, a refused text waits (returning false) so the field is never rebuilt under their hands.
 */
function commitText(raw: string, leaving: boolean): boolean {
  if (raw === text) return true
  const result = oncommit(raw)
  if (result.ok) {
    message = undefined
    return true
  }
  if (leaving) {
    message = result.message
    revision++
  }
  return false
}

function onTextKey(event: KeyboardEvent): void {
  const box = event.currentTarget as HTMLInputElement
  if (event.key === 'Enter' && row.widget === 'text') {
    event.preventDefault()
    commitText(box.value, true)
  } else if (event.key === 'Escape') {
    box.value = text
    // Tell the typing registry, so the text it was holding is the stored one and nothing is written.
    box.dispatchEvent(new Event('input'))
    message = undefined
  }
}
</script>

<div class="field" data-widget={row.widget} data-field={row.id}>
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
      <span class="label" aria-hidden="true">{row.label}</span>
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
      <span class="label" aria-hidden="true">{row.label}</span>
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
      <label class="label" for={`${uid}-text`}>{row.label}</label>
      {#if row.widget === 'text'}
        <input
          id={`${uid}-text`}
          class="text"
          type="text"
          use:typedSave={{ drafts, value: text, commit: commitText, draftKey: row.id }}
          aria-describedby={message ? `${uid}-message` : undefined}
          onkeydown={onTextKey}
        />
      {:else}
        <textarea
          id={`${uid}-text`}
          class="text"
          rows="3"
          use:typedSave={{ drafts, value: text, commit: commitText, draftKey: row.id }}
          aria-describedby={message ? `${uid}-message` : undefined}
          onkeydown={onTextKey}
        ></textarea>
      {/if}
    {:else if row.widget === 'point'}
      <span class="label">{row.label}</span>
      <div class="pair">
        <Stepper label={`${row.label} x`} value={point.x} onedit={(event) => committed(event.phase) && commit({ ...point, x: event.value })} />
        <Stepper label={`${row.label} y`} value={point.y} onedit={(event) => committed(event.phase) && commit({ ...point, y: event.value })} />
      </div>
    {:else if row.widget === 'points'}
      <span class="label">{row.label}</span>
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
      <span class="label">{row.label}</span>
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
      <span class="label">{row.label}</span>
      <span class="value">{Array.isArray(row.value) ? `${row.value.length} items` : ''}</span>
    {/if}
  {/key}
  {#if message && row.widget !== 'stepper'}
    <p class="message" id={`${uid}-message`} role="alert">{message}</p>
  {/if}
</div>

<style>
  /* Stacked by default, the name over its control; an inspector that reads label-left sets `--label-columns`, so the
     name and the control share a row. A widget that draws its own name (a stepper, a colour, a picker) spans both
     columns and lines its name up through `--label-flex` instead, and so does a message under a control; the control
     right after a name takes `--label-control-column` (2 when label-left). */
  .field {
    display: grid;
    grid-template-columns: var(--label-columns, minmax(0, 1fr));
    align-items: center;
    gap: var(--space-1) var(--space-2);
    min-width: 0;
  }
  .field > * {
    grid-column: 1 / -1;
  }
  .field > .label {
    grid-column: 1;
  }
  .field > .label + * {
    grid-column: var(--label-control-column, 1 / -1);
  }
  .label {
    color: var(--muted);
    font: var(--text-label-12);
  }
  .text {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
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
  .message {
    margin: 0;
    color: var(--bad);
    font: var(--text-body-13);
  }
</style>
