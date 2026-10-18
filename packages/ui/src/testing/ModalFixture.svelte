<!-- A Modal for the layout contracts: its panel, and a probe that reads the width its content may lay out in. -->
<script lang="ts">
import Modal from '../dialog/Modal.svelte'

const none = (): void => undefined
</script>

<Modal title="Settings" closeLabel="Close" onclose={none} testId="modal-panel">
  <div data-testid="modal-probe" class="af-modal-probe">Language, Audio, Display</div>
</Modal>

<style>
  /* Two across where the dialog is wide enough, as a Settings tab would lay its groups out. */
  .af-modal-probe {
    columns: 1;
  }
  @container af-dialog (min-width: 560px) {
    .af-modal-probe {
      columns: 2;
    }
  }
</style>
