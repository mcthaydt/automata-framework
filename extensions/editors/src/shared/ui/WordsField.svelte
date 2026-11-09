<!--
  Words a person writes: a text field that grows with what is typed, saved when the person leaves it (or presses
  Ctrl+Enter), never on every keystroke. Enter makes a new line, so a long speech can be written as it is said.
-->
<script lang="ts">
interface Props {
  label: string
  value: string
  placeholder?: string | undefined
  problem?: string | undefined
  /** Called on every keystroke, for a form that reads the words when its own button is pressed. */
  oninput?: ((value: string) => void) | undefined
  onchange?: ((value: string) => void) | undefined
}

const { label, value, placeholder, problem, oninput, onchange }: Props = $props()
const id = `words-${Math.random().toString(36).slice(2)}`

function commit(event: Event & { currentTarget: HTMLTextAreaElement }): void {
  const raw = event.currentTarget.value
  if (raw !== value) onchange?.(raw)
}
</script>

<div class="words">
  <label for={id}>{label}</label>
  <textarea
    {id}
    rows="2"
    {placeholder}
    {value}
    aria-invalid={problem !== undefined}
    onchange={commit}
    oninput={(event) => oninput?.(event.currentTarget.value)}
    onkeydown={(event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) event.currentTarget.blur()
    }}
  ></textarea>
  {#if problem !== undefined}<p class="problem" role="alert">{problem}</p>{/if}
</div>

<style>
  .words {
    display: grid;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    resize: vertical;
    field-sizing: content;
  }
  textarea[aria-invalid='true'] {
    border-color: var(--color-state-bad);
  }
  .problem {
    margin: 0;
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
