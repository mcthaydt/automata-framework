<!--
  @component
  An on/off setting (M4 spec §4.12): a native checkbox with the switch role, so the browser gives
  Space and the focus navigator's `adjust` flips it. The state shows in words (`onLabel`,
  `offLabel`) beside the track, never in colour alone.

  Controlled, as OptionGroup is: a click reports the new state through `onchange`, and the box
  shows the `checked` it is given.
-->
<script lang="ts">
import { flushSync } from 'svelte'

interface Props {
  label: string
  checked: boolean
  /** The words for each state, in the game's language. */
  onLabel: string
  offLabel: string
  onchange: (checked: boolean) => void
  disabled?: boolean | undefined
  testId?: string | undefined
}

const { label, checked, onLabel, offLabel, onchange, disabled = false, testId }: Props = $props()

function flip(event: Event & { currentTarget: HTMLInputElement }): void {
  const input = event.currentTarget
  onchange(input.checked)
  flushSync()
  // The browser has already flipped the box; put the owner's state back if it did not take it.
  input.checked = checked
}
</script>

<label class="af-control af-toggle" data-testid={testId} data-checked={String(checked)}>
  <span class="af-toggle__label">{label}</span>
  <input class="af-toggle__input" type="checkbox" role="switch" {checked} {disabled} onchange={flip} />
  <span class="af-toggle__track" aria-hidden="true"><span class="af-toggle__thumb"></span></span>
  <span class="af-toggle__state" data-toggle-state aria-hidden="true">{checked ? onLabel : offLabel}</span>
</label>

<style>
  .af-toggle {
    justify-content: space-between;
    gap: 12px;
  }

  .af-toggle__label {
    flex: 1;
    text-align: start;
  }

  /* The input stays in the accessibility tree and takes focus; the track draws it. */
  .af-toggle__input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: 0;
  }

  .af-toggle__track {
    position: relative;
    flex: none;
    width: 40px;
    height: 22px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: 11px;
    background: var(--af-surface);
  }

  .af-toggle__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--af-edge);
  }

  [data-checked="true"] .af-toggle__track {
    border-color: var(--af-accent);
    background: var(--af-accent);
  }

  [data-checked="true"] .af-toggle__thumb {
    left: auto;
    right: 2px;
    background: var(--af-on-accent);
  }

  .af-toggle__state {
    min-width: 3ch;
    text-align: end;
  }

  .af-toggle:has(.af-toggle__input:focus-visible) {
    outline: var(--af-ring-width) solid var(--af-ring);
    outline-offset: 2px;
  }

  .af-toggle:has(.af-toggle__input:disabled) {
    opacity: 0.5;
    cursor: default;
  }
</style>
