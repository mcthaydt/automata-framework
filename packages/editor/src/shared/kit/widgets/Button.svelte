<!--
  The button of the editors' screens. `plain` is a 44 px target, `primary` the 48 px action a screen
  is for (Open, New), `danger` marks what destroys. The kind is `data-kind`, the attribute the layout checks read to
  hold a primary action to 48 px. Whatever else a button needs (an accessible name, a title) passes
  through. It never submits a form, and a disabled one stays in the page and in the layout rather than vanishing.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'

interface Props extends Omit<HTMLButtonAttributes, 'type' | 'children'> {
  variant?: 'plain' | 'primary' | 'danger'
  children: Snippet
}

const { variant = 'plain', children, ...rest }: Props = $props()
</script>

<button type="button" data-kind={variant} {...rest}>{@render children()}</button>

<style>
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
    white-space: nowrap;
    cursor: pointer;
  }
  button[data-kind='primary'] {
    min-height: var(--size-primary);
    border-color: transparent;
    background: var(--color-accent-default);
    color: var(--color-accent-ink);
  }
  button[data-kind='danger'] {
    border-color: var(--color-state-bad);
    color: var(--color-state-bad);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
</style>
