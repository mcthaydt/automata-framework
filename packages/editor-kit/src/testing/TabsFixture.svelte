<!-- Tabs with a panel snippet, for the widget tests: each panel says which tab it belongs to. -->
<script lang="ts">
import Tabs from '../widgets/Tabs.svelte'

interface Tab {
  id: string
  label: string
  disabled?: boolean | undefined
  reason?: string | undefined
}

interface Props {
  tabs: readonly Tab[]
  value: string
  onselect?: ((id: string) => void) | undefined
  onblocked?: ((reason: string | undefined) => void) | undefined
}

let { tabs, value = $bindable(), onselect, onblocked }: Props = $props()
</script>

<Tabs label="Inspector" {tabs} bind:value {onselect} {onblocked}>
  {#snippet panel(id)}
    <p>Panel {id}</p>
    <button type="button">Inside {id}</button>
  {/snippet}
</Tabs>
