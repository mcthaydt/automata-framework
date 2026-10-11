<!-- A confirm dialog for the layout contracts (M1.6 plan Task 11): a title, a paragraph, two actions. -->
<script lang="ts">
import Dialog from '../dialog/Dialog.svelte'

const none = (): void => undefined
</script>

<Dialog title="Delete this save?" onclose={none}>
  <p style="margin: 0">
    Your progress in this slot will be gone for good. Other slots are not touched, and you can start
    a new game here at any time.
  </p>
  {#snippet actions()}
    <button type="button" class="af-control" data-testid="dialog-cancel" data-initial-focus>Keep it</button>
    <button type="button" class="af-control af-control--primary" data-kind="primary" data-testid="dialog-confirm">Delete</button>
  {/snippet}
</Dialog>
