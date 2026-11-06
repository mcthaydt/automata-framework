<!--
  Shown in place of the project list when the workspace cannot be listed. The sources
  panel and whatever the editor shows beside it stay usable; Retry reads the workspace again.
-->
<script lang="ts">
import Button from '../widgets/Button.svelte'

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
    border: 1px solid var(--bad);
    border-radius: var(--edge-lg);
    background: var(--paper);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  p {
    margin: 0;
    color: var(--muted);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
</style>
