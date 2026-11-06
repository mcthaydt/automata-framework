<!--
  A 44 px square button that shows an icon, borderless until hovered so a toolbar reads as one quiet strip. `label` is its accessible name and its tooltip (the browser's
  title, shown on hover and, on iPad, on a long press); with `showLabel` the label is also written beside the icon,
  for where there is room, and the button grows wider. `pressed` makes it a toggle (a layer's eye or lock) and
  is announced as one. It never submits a form; a disabled one stays in place.
-->
<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'
import type { IconName } from '../icons/paths'

interface Props
  extends Omit<HTMLButtonAttributes, 'type' | 'children' | 'title' | 'aria-label' | 'aria-pressed'> {
  icon: IconName
  label: string
  showLabel?: boolean
  pressed?: boolean | undefined
}

const { icon, label, showLabel = false, pressed, ...rest }: Props = $props()
</script>

<button
  type="button"
  class="icon-button"
  data-labelled={showLabel}
  title={label}
  aria-label={showLabel ? undefined : label}
  aria-pressed={pressed}
  {...rest}
>
  <Icon name={icon} />
  {#if showLabel}<span>{label}</span>{/if}
</button>

<style>
  .icon-button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: var(--size-hit);
    height: var(--size-hit);
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--edge);
    background: transparent;
    color: var(--ink);
    font: var(--text-body-13-medium);
    white-space: nowrap;
    cursor: pointer;
    transition: background 160ms var(--ease-out);
  }
  .icon-button[data-labelled='true'] {
    width: auto;
    padding: 0 var(--space-4) 0 var(--space-3);
  }
  .icon-button:hover:not(:disabled) {
    border-color: var(--line-strong);
    background: var(--surface);
  }
  .icon-button[aria-pressed='true'] {
    border-color: var(--cobalt);
    background: var(--cobalt-soft);
    color: var(--cobalt);
  }
  .icon-button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .icon-button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
