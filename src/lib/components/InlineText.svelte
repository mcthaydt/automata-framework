<script lang="ts">
  import { parseInline } from '../utils/markdown'
  let { text = '' }: { text?: string } = $props()
</script>
{#each parseInline(text) as part}{#if part.type === 'code'}<code>{part.text}</code>{:else if part.type === 'link'}<a href={part.href}>{part.text}</a>{:else}{part.text}{/if}{/each}
