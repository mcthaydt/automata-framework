<script lang="ts">
import DocsPage from '../../../features/docs/DocsPage.svelte'
import type { PageData } from './$types'

interface Props {
  data: PageData
}

let { data }: Props = $props()
</script>

<DocsPage slug={data.slug} />
