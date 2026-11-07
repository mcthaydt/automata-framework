<script lang="ts">
import ExamplesIndex from '../../features/examples/ExamplesIndex.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<ExamplesIndex {data} />
