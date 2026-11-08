<!--
  One labelled field of a sentence: a number with its unit, or a short text. What is typed is written half a second
  after the last key and when the person leaves the field or presses Enter, but only when it is a value: a half-typed
  "0." or a name cleared to be retyped waits, untouched, and nothing is said until the person leaves. A value outside
  its range is refused in words beside the field and not written. A field that names something other files point at
  (`commit="leave"`) is written only when it is left.
-->
<script lang="ts">
import { typedSave, typingDrafts } from '@automata/editor/kit/typing'

interface Props {
  label: string
  kind: 'number' | 'text' | 'choice'
  value: number | string
  /** The choices of a `choice` field, each with the words shown for it. */
  options?: readonly { readonly value: string; readonly label: string }[] | undefined
  unit?: string | undefined
  min?: number | undefined
  max?: number | undefined
  step?: number | undefined
  disabled?: boolean | undefined
  problem?: string | undefined
  /** `leave`: write only when the field is left, as a name other files point at must be. */
  commit?: 'typing' | 'leave' | undefined
  onchange: (value: number | string) => void
}

const {
  label,
  kind,
  value,
  options = [],
  unit,
  min,
  max,
  step,
  disabled = false,
  problem,
  commit: when = 'typing',
  onchange,
}: Props = $props()
let refusal = $state<string | undefined>()
const id = `field-${Math.random().toString(36).slice(2)}`

const drafts = typingDrafts()

/** What `raw` is as this field's value, or why it is not one. */
function check(raw: string): { ok: true; value: number | string } | { ok: false; refusal: string } {
  if (kind === 'text')
    return raw.trim() === '' ? { ok: false, refusal: 'This cannot be empty.' } : { ok: true, value: raw }
  const number = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(number)) return { ok: false, refusal: 'Type a number.' }
  if (min !== undefined && number < min) return { ok: false, refusal: `The least is ${String(min)}.` }
  if (max !== undefined && number > max) return { ok: false, refusal: `The most is ${String(max)}.` }
  return { ok: true, value: number }
}

/** Writes what was typed. While the person is typing only a value gets here; on leaving, a refusal is said. */
function commit(raw: string, node: HTMLInputElement | undefined): void {
  const checked = check(raw)
  if (!checked.ok) {
    refusal = checked.refusal
    if (node !== undefined) node.value = String(value)
    return
  }
  refusal = undefined
  if (checked.value !== value) onchange(checked.value)
}

let input = $state<HTMLInputElement>()
</script>

<div class="row">
  <label for={id}>{label}</label>
  <span class="input">
    {#if kind === 'choice'}
      <select
        {id}
        {disabled}
        value={String(value)}
        onchange={(event) => {
          if (event.currentTarget.value !== value) onchange(event.currentTarget.value)
        }}
      >
        {#each options as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
      </select>
    {:else}
    <input
      {id}
      type={kind === 'number' ? 'number' : 'text'}
      inputmode={kind === 'number' ? 'decimal' : undefined}
      bind:this={input}
      {min}
      {max}
      {step}
      {disabled}
      aria-invalid={problem !== undefined || refusal !== undefined}
      use:typedSave={{
        drafts,
        value: String(value),
        commit: (raw) => commit(raw, input),
        draftKey: label,
        valid: (raw) => check(raw).ok,
        leaveOnly: when === 'leave',
      }}
      onkeydown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
    {/if}
    {#if unit !== undefined}<span class="unit">{unit}</span>{/if}
  </span>
  {#if refusal !== undefined || problem !== undefined}
    <p class="problem" role="alert">{refusal ?? problem}</p>
  {/if}
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .input {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  input,
  select {
    width: 8rem;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  select {
    width: auto;
    min-width: 8rem;
  }
  input[aria-invalid='true'] {
    border-color: var(--color-state-bad);
  }
  .unit {
    color: var(--color-text-faint);
    font: var(--text-body-13);
  }
  .problem {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
