<!--
  A widget with a bug, for the shell's error-boundary tests: it throws while it first renders, or, with
  `breaks="click"`, renders a button whose click makes its next render throw (an error from a later update).
-->
<script lang="ts">
interface Props {
  breaks: 'mount' | 'click'
}

const { breaks }: Props = $props()

let clicked = $state(false)

function explode(): string {
  throw new Error('the widget broke')
}

// The prop only says when this instance breaks; it never changes after mount.
// svelte-ignore state_referenced_locally
if (breaks === 'mount') explode()
</script>

<button type="button" data-testid="break-it" onclick={() => (clicked = true)}>Break</button>
{#if clicked}<span>{explode()}</span>{/if}
