<script lang="ts">
import ExamplePage from '../../../features/examples/ExamplePage.svelte'
import SceneFrame from '../../../features/examples/SceneFrame.svelte'
import Playground from '../../../features/playground/Playground.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<ExamplePage {data}>
  {#if 'frameUrl' in data.example}
    {#key data.example.id}<SceneFrame example={data.example} highlighted={data.highlighted} />{/key}
  {:else}
    {#key data.example.id}<Playground example={data.example} highlighted={data.highlighted} />{/key}
  {/if}
</ExamplePage>
