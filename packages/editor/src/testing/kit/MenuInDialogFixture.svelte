<!-- A menu inside an open dialog, for the popup tests: the menu must stay inside the dialog's reach. -->
<script lang="ts">
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'

interface Props {
  onselect?: ((id: string) => void) | undefined
  onclose?: ((why: 'escape' | 'scrim' | 'action') => void) | undefined
}

const { onselect, onclose }: Props = $props()

let open = $state(true)
const items = [
  { id: 'a', label: 'First' },
  { id: 'b', label: 'Second' },
]
</script>

<Dialog bind:open title="Layer options" {onclose}>
  <Menu label="More" {items} {onselect} />
</Dialog>
