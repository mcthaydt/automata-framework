<script lang="ts">
// The one shell every page sits in: the same left edge as the header's logo and the same padding. A reading page
// keeps a comfortable line; a `wide` one (two or three columns) takes the whole wrap, from the same left edge.
import type { Snippet } from 'svelte'

let {
  wide = false,
  class: className = '',
  children,
}: { wide?: boolean; class?: string; children?: Snippet } = $props()
</script>
<div class="page-wrap">
  <div class={`page-shell ${className}`} class:wide data-page-shell>{@render children?.()}</div>
</div>
