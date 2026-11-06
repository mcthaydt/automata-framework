<!--
  @component
  A choice of one: a
  segmented row whose chosen option is filled and marked, never only underlined or only coloured.

  Native radios in a fieldset, rather than `<button role="radio">` buttons: the browser gives the arrow keys,
  and the focus navigator's `adjust` cycles a named radio group, so a pad changes it without leaving it.

  Controlled: it reports a choice through `onchange` and shows the `value` it is given. A choice the owner does
  not take is undone, so what is checked is always the owner's value.
-->
<script lang="ts">
import { flushSync } from 'svelte'

interface Option {
  readonly value: string
  readonly label: string
  /** The option's name for assistive technology, where its face is a symbol. */
  readonly ariaLabel?: string | undefined
  readonly testId?: string | undefined
  /** The option's language, where its face is in one of its own (a language's endonym). */
  readonly lang?: string | undefined
}

interface Props {
  /** The group's name, shown as its legend. */
  label: string
  options: readonly Option[]
  /** The chosen option's value; nothing is checked while it is undefined. */
  value: string | undefined
  onchange: (value: string) => void
  disabled?: boolean | undefined
  testId?: string | undefined
  /** The legend for assistive technology only, where a heading above already names the group. */
  legendHidden?: boolean | undefined
}

const { label, options, value, onchange, disabled = false, testId, legendHidden = false }: Props = $props()

const name = $props.id()
let group = $state<HTMLElement | undefined>(undefined)

function choose(chosen: string): void {
  onchange(chosen)
  flushSync()
  // The browser has already checked the clicked radio; put the owner's value back if it did not take it.
  for (const radio of group?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? []) {
    radio.checked = radio.value === value
  }
}
</script>

<fieldset bind:this={group} class="af-options" data-testid={testId}>
  <legend class={legendHidden ? 'af-sr-only' : 'af-options__label'}>{label}</legend>
  <div class="af-options__row">
    {#each options as option (option.value)}
      {@const selected = option.value === value}
      <label
        class="af-control af-option"
        data-selected={String(selected)}
        data-testid={option.testId}
        lang={option.lang}
      >
        <input
          class="af-sr-only"
          type="radio"
          {name}
          value={option.value}
          checked={selected}
          {disabled}
          aria-label={option.ariaLabel}
          onchange={() => choose(option.value)}
        />
        {#if selected}<span class="af-option__mark" data-option-mark aria-hidden="true">✓</span>{/if}
        {option.label}
      </label>
    {/each}
  </div>
</fieldset>

<style>
  /* A group wraps whole, never mid-group: the legend and its options stay one line where they fit. */
  .af-options {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .af-options__label {
    float: left;
    padding: 0;
    color: var(--af-muted);
    font: 600 var(--af-text-small) / 1.2 var(--af-font);
  }

  .af-options__row {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .af-option[data-selected='true'] {
    border-color: var(--af-accent);
    background: var(--af-accent);
    color: var(--af-on-accent);
  }

  /* The ring sits on the label, since the radio itself is visually hidden. */
  .af-option:has(input:focus-visible) {
    outline: var(--af-ring-width) solid var(--af-ring);
    outline-offset: 2px;
  }

  .af-option:has(input:disabled) {
    opacity: 0.5;
    cursor: default;
  }
</style>
