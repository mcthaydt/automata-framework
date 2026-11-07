<script lang="ts">
import ExamplePage from '../../../features/examples/ExamplePage.svelte'
import Playground from '../../../features/playground/Playground.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<ExamplePage {data}>
  {#key data.example.id}<Playground example={data.example} highlighted={data.highlighted} />{/key}
</ExamplePage>
