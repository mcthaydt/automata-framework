<script lang="ts">
// Markdown's inline parts (code, bold, links) as Svelte content: `parseInline` never yields HTML, so a guide cannot
// inject markup or a script link into the page.
import { parseInline } from '../utils/markdown'

let { text = '' }: { text?: string } = $props()
</script>
{#each parseInline(text) as part}{#if part.type === 'code'}<code>{part.text}</code>{:else if part.type === 'strong'}<strong>{part.text}</strong>{:else if part.type === 'link'}<a href={part.href}>{part.text}</a>{:else}{part.text}{/if}{/each}
