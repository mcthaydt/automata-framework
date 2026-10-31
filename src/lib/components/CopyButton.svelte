<script lang="ts">
  import { onDestroy } from 'svelte'
  let { text, label = 'Copy code', caption = 'Copy', copied = 'Copied', blocked = "Couldn't copy. Select the text and copy it manually." }: {
    text: string; label?: string; caption?: string; copied?: string; blocked?: string
  } = $props()
  let message = $state('')
  let timer: ReturnType<typeof setTimeout> | undefined
  async function copy() {
    clearTimeout(timer)
    try {
      await navigator.clipboard.writeText(text)
      message = copied
    } catch {
      message = blocked
    }
    timer = setTimeout(() => message = '', 5000)
  }
  onDestroy(() => clearTimeout(timer))
</script>
<div class="copy-control">
  <button type="button" aria-label={label} onclick={copy}>{caption}</button>
  <span role="status">{message}</span>
</div>
