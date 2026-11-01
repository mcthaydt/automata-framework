<!-- The checks sheet: the pill in the document bar opens the list of problems, with a Show button on each (touch). -->
<script lang="ts">
import { Button, Dialog } from '@mcthaydt/automata-editor-kit'
import type { ChecksPanel } from '../../app/checks-panel-controller'
import ChecksList from './ChecksList.svelte'

const { checks, onclose }: { checks: ChecksPanel; onclose: () => void } = $props()
</script>

<Dialog open={true} title="Checks" width="wide" {onclose}>
  <ChecksList {checks} />
  {#snippet actions({ close })}
    <Button onclick={close}>Done</Button>
  {/snippet}
</Dialog>
