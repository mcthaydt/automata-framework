<!--
  The button of the editors' screens: slightly rounded, flat and quiet, so the work is what stands out. `secondary` is the
  raised face with a strong edge that steps up under the pointer, and a 44 px target with touch; `primary` is the
  flat lime panel, 48 px with touch, for the one action a screen is for (Publish) or a dialog's one confirm, never
  anything else; `quiet` has no border, for a second action beside a primary; `danger` is red text on a pale red wash, for
  what destroys, so it never reads as a red outline next to a primary. The kind is `data-kind`, which the layout checks
  read to hold a primary action to 48 px. Whatever else a button needs (an accessible name, a title) passes through. It
  never submits a form, and a disabled one stays in the page and in the layout rather than vanishing.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLButtonAttributes } from 'svelte/elements'

interface Props extends Omit<HTMLButtonAttributes, 'type' | 'children'> {
  variant?: 'secondary' | 'primary' | 'quiet' | 'danger'
  children: Snippet
}

const { variant = 'secondary', children, ...rest }: Props = $props()
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
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--raise);
    color: var(--ink);
    font: var(--text-body-13-medium);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 140ms var(--ease-out),
      border-color 140ms var(--ease-out),
      transform 140ms var(--ease-out);
  }
  /* Hover steps the button up 1 px and a press sinks it 1 px below rest, so a pointer always sees it answer; touch
     and reduced motion keep it still. */
  @media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
    button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
    button:active:not(:disabled) {
      transform: translateY(1px) scale(0.985);
      transition-duration: 90ms;
    }
  }
  button:hover:not(:disabled) {
    border-color: var(--line-hover);
  }
  button[data-kind='primary'] {
    min-height: var(--size-primary);
    padding: 0 var(--space-5);
    border-color: var(--primary-edge);
    background: var(--primary);
    color: var(--primary-ink);
    font-weight: 600;
  }
  button[data-kind='primary']:hover:not(:disabled) {
    border-color: var(--primary-edge);
    background: var(--primary-hover);
  }
  button[data-kind='quiet'] {
    border-color: transparent;
    background: transparent;
  }
  button[data-kind='quiet']:hover:not(:disabled) {
    border-color: transparent;
    background: var(--surface);
  }
  button[data-kind='danger'] {
    border-color: transparent;
    background: var(--danger-wash);
    color: var(--bad);
  }
  button[data-kind='danger']:hover:not(:disabled) {
    background: var(--danger-wash);
    border-color: var(--bad);
  }
  button:disabled {
    opacity: 0.45;
    box-shadow: none;
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
