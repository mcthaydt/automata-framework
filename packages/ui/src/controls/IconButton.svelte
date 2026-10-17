<!--
  A button whose face is an icon (M4 spec §4.12). Its accessible name is `label`, which it cannot
  do without: an empty label throws while it mounts, so a nameless icon button fails its first test
  instead of reaching a player. The icon is decoration and hidden from assistive technology.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  /** The button's name, in the game's language. Required and never empty. */
  label: string
  icon: Snippet
  kind?: 'primary' | 'secondary' | 'ghost' | undefined
  disabled?: boolean | undefined
  onclick?: (() => void) | undefined
  testId?: string | undefined
}

const { label, icon, kind = 'ghost', disabled = false, onclick, testId }: Props = $props()

// The check runs once, at mount, by design: a label that later empties is a game bug the first mount catches.
// svelte-ignore state_referenced_locally
if (label.trim() === '') throw new Error('IconButton needs a label: it is the only name the button has')
</script>

<button
  type="button"
  class="af-control af-icon-button"
  class:af-control--primary={kind === 'primary'}
  class:af-control--ghost={kind === 'ghost'}
  data-kind={kind}
  data-testid={testId}
  aria-label={label}
  title={label}
  {disabled}
  {onclick}
>
  <span class="af-icon-button__icon" aria-hidden="true">{@render icon()}</span>
</button>

<style>
  /* Square at the target size; the icon fills a little over half of it. */
  .af-icon-button {
    padding: 0;
    width: var(--af-target);
  }

  .af-icon-button[data-kind="primary"] {
    width: var(--af-target-primary);
  }

  .af-icon-button__icon {
    display: inline-flex;
    width: 60%;
    height: 60%;
  }

  .af-icon-button__icon :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
