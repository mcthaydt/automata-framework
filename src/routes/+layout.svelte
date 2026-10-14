<script lang="ts">
import '../app.css'

// biome-ignore lint/correctness/noUnusedVariables: Svelte 5 children snippet
let { children } = $props()
</script>

{@render children()}
