<script lang="ts">
  import CopyButton from './CopyButton.svelte'
  let { command = '' }: { command?: string } = $props()
</script>
<div class="terminal"><code>{command}</code><CopyButton text={command} label="Copy command" /></div>
