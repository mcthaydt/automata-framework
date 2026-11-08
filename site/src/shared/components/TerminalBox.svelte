<script lang="ts">
// One shell command and its Copy button, drawn as a terminal line.
import CopyButton from './CopyButton.svelte'

let { command = '' }: { command?: string } = $props()
</script>
<div class="terminal"><code>{command}</code><CopyButton text={command} label="Copy command" /></div>
