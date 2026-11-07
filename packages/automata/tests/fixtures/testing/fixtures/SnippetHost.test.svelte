<!-- Test host for text-snippet.test.ts only: renders the snippet it is given. -->
<script lang="ts">
import type { Snippet } from 'svelte'

const { content }: { content: Snippet } = $props()
</script>

{@render content()}
