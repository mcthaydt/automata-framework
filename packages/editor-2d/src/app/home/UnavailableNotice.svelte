<!--
  Shown in place of the project list when the workspace cannot be listed (plan ED2D.4c2a, failure table). The sources
  panel and the templates beside it stay usable; Retry reads the workspace again.
-->
<script lang="ts">
import { Button } from '@mcthaydt/automata-editor-kit'

interface Props {
  /** The storage layer's own words for what went wrong. */
  message: string
  onretry: () => void
}

const { message, onretry }: Props = $props()
</script>

<div class="notice" role="alert">
  <h2>Your projects can’t be listed</h2>
  <p>{message}</p>
  <Button onclick={onretry}>Retry</Button>
</div>

<style>
  .notice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--color-state-bad);
    border-radius: var(--radius-lg);
    background: var(--color-bg-surface);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  p {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
</style>
