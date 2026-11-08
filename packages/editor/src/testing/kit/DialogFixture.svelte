<!-- An opener button and a dialog with a field and two actions, for the widget tests. -->
<script lang="ts">
import Dialog from '../../shared/kit/widgets/Dialog.svelte'

interface Props {
  dismissible?: boolean
  autofocus?: boolean
  startOpen?: boolean
  width?: 'normal' | 'wide'
  onclose?: ((why: 'escape' | 'scrim' | 'action') => void) | undefined
}

const { dismissible = true, autofocus = false, startOpen = false, width, onclose }: Props = $props()

// svelte-ignore state_referenced_locally
let open = $state(startOpen)
</script>

<button type="button" onclick={() => (open = true)}>Open</button>
<button type="button" onclick={() => (open = false)}>Close from outside</button>

<Dialog bind:open title="Delete layer" {dismissible} {width} {onclose}>
  <p>Its 14 tiles go with it.</p>
  <input aria-label="Reason" />
  {#snippet actions({ close })}
    <button type="button" onclick={() => close()}>Cancel</button>
    <button type="button" data-primary data-autofocus={autofocus || undefined} onclick={() => close()}>Delete</button>
  {/snippet}
</Dialog>
