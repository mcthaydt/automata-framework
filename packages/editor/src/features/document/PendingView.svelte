<!--
  A view is not built yet. It says so in plain words and that the
  project is safe, inside the same shell, so the top bar stays where it is.
-->
<script lang="ts">
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import type { ViewProps } from '../../shared/level-2d/session/view-props'

const { geometry, label, frame }: ViewProps = $props()
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  sheets={frame.sheets}
  testId="pending-view"
>
  {#snippet canvas()}
    <div class="pending" role="status">
      <h2>{label} is coming in a later update</h2>
      <p>Your project is safe. Choose Level to keep editing.</p>
    </div>
  {/snippet}
</EditorShell>

<style>
  .pending {
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  p {
    margin: 0;
  }
</style>
