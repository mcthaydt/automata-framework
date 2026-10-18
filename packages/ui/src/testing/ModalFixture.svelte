<!-- A Modal for the layout contracts: its panel, a probe that reads the width its content may lay out in, and a
     head of two tabs. -->
<script lang="ts">
import Modal from '../dialog/Modal.svelte'

const none = (): void => undefined
</script>

{#snippet head()}
  <div data-testid="modal-head-probe" class="af-modal-head-probe">
    <button type="button" class="af-control">Settings</button>
    <button type="button" class="af-control">Controls</button>
  </div>
{/snippet}

<Modal title="Settings" closeLabel="Close" onclose={none} testId="modal-panel" {head}>
  <div data-testid="modal-probe" class="af-modal-probe">Language, Audio, Display</div>
</Modal>

<style>
  /* Two across where the dialog is wide enough, as a Settings tab would lay its groups out. */
  .af-modal-probe {
    columns: 1;
  }
  .af-modal-head-probe {
    display: flex;
    gap: 8px;
  }
  @container af-dialog (min-width: 560px) {
    .af-modal-probe {
      columns: 2;
    }
  }
</style>
