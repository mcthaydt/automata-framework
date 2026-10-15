<script lang="ts">
  import { onDestroy } from 'svelte'
  let { text, label = 'Copy code' }: { text: string; label?: string } = $props()
  let message = $state('')
  let timer: ReturnType<typeof setTimeout> | undefined
  async function copy() {
    clearTimeout(timer)
    try {
      await navigator.clipboard.writeText(text)
      message = 'Copied'
    } catch {
      message = "Couldn't copy. Select the text and copy it manually."
    }
    timer = setTimeout(() => message = '', 5000)
  }
  onDestroy(() => clearTimeout(timer))
</script>
<div class="copy-control">
  <button type="button" aria-label={label} onclick={copy}>Copy</button>
  <span role="status">{message}</span>
</div>
