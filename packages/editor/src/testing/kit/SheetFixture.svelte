<!-- An opener button and a sheet with two buttons, for the sheet's focus tests. -->
<script lang="ts">
import Sheet from '../../shared/kit/sheets/Sheet.svelte'

let open = $state(false)
</script>

<button type="button" onclick={() => (open = true)}>Open</button>

<Sheet {open} label="More editors" onclose={() => (open = false)}>
  <button type="button">First</button>
  <button type="button">Last</button>
</Sheet>
