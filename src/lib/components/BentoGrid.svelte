<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    children?: Snippet
    class?: string
  }

  let { children, class: className = '' }: Props = $props()
</script>

<div class={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}>
  {@render children?.()}
</div>
