<script lang="ts">
import ApiPackage from '../../../../features/api/ApiPackage.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<ApiPackage {data} />
