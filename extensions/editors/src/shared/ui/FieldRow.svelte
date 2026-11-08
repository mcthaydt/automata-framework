<!--
  One labelled field of a sentence: a number with its unit, or a short text. A number commits when the person leaves
  it or presses Enter, never on every keystroke, so a half-typed "0." is not written to the game. A value outside its
  range is refused in words beside the field and not written.
-->
<script lang="ts">
interface Props {
  label: string
  kind: 'number' | 'text'
  value: number | string
  unit?: string | undefined
  min?: number | undefined
  max?: number | undefined
  step?: number | undefined
  disabled?: boolean | undefined
  problem?: string | undefined
  onchange: (value: number | string) => void
}

const { label, kind, value, unit, min, max, step, disabled = false, problem, onchange }: Props = $props()
let refusal = $state<string | undefined>()
const id = `field-${Math.random().toString(36).slice(2)}`

function commit(event: Event & { currentTarget: HTMLInputElement }): void {
  const raw = event.currentTarget.value
  if (kind === 'text') {
    if (raw.trim() === '') {
      refusal = 'This cannot be empty.'
      event.currentTarget.value = String(value)
      return
    }
    refusal = undefined
    if (raw !== value) onchange(raw)
    return
  }
  const number = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(number)) refusal = 'Type a number.'
  else if (min !== undefined && number < min) refusal = `The least is ${String(min)}.`
  else if (max !== undefined && number > max) refusal = `The most is ${String(max)}.`
  else {
    refusal = undefined
    if (number !== value) onchange(number)
    return
  }
  event.currentTarget.value = String(value)
}
</script>

<div class="row">
  <label for={id}>{label}</label>
  <span class="input">
    <input
      {id}
      type={kind === 'number' ? 'number' : 'text'}
      inputmode={kind === 'number' ? 'decimal' : undefined}
      value={String(value)}
      {min}
      {max}
      {step}
      {disabled}
      aria-invalid={problem !== undefined || refusal !== undefined}
      onchange={commit}
      onkeydown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
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
  input {
    width: 8rem;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
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
