<!--
  One colour as a 44 px target; the visible chip is smaller than the box that takes the press. As a
  `toggle` it is a button that says whether it is on (`aria-pressed`); as an `option` it belongs to a listbox
  (`aria-selected`). `label` is what a screen reader hears, usually the hex.
-->
<script lang="ts">
interface Props {
  color: string
  label: string
  selected?: boolean
  kind?: 'toggle' | 'option'
  tabindex?: number
  button?: HTMLButtonElement | undefined
  onpress?: (() => void) | undefined
  onkeydown?: ((event: KeyboardEvent) => void) | undefined
}

let {
  color,
  label,
  selected = false,
  kind = 'toggle',
  tabindex,
  button = $bindable(),
  onpress,
  onkeydown,
}: Props = $props()
</script>

<button
  type="button"
  class="swatch"
  data-widget="swatch"
  role={kind === 'option' ? 'option' : undefined}
  aria-label={label}
  aria-pressed={kind === 'toggle' ? selected : undefined}
  aria-selected={kind === 'option' ? selected : undefined}
  {tabindex}
  bind:this={button}
  onclick={() => onpress?.()}
  {onkeydown}
>
  <span class="chip" style:background={color}></span>
</button>

<style>
  .swatch {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-hit);
    height: var(--size-hit);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    cursor: pointer;
  }
  .chip {
    box-sizing: border-box;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
  }
  .swatch[aria-pressed='true'] .chip,
  .swatch[aria-selected='true'] .chip {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .swatch:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
</style>
