<!--
  @component
  The tab is out of date: core's ErrorPanel with the code `stale-build`, what happened and one primary action, Reload,
  which takes focus. There is no other way forward on purpose: a tab that cannot join is no use until it is reloaded.
-->
<script lang="ts">
import { ErrorPanel } from '@automataframework/framework'
import { onMount } from 'svelte'

interface Props {
  copy: { readonly message: string; readonly reload: string }
  onReload: () => void
}

const { copy, onReload }: Props = $props()

let root = $state<HTMLElement | undefined>(undefined)
onMount(() => root?.querySelector<HTMLElement>('button')?.focus())
</script>

<div bind:this={root} data-testid="stale-build">
  <ErrorPanel
    code="stale-build"
    message={copy.message}
    actions={[{ id: 'reload', label: copy.reload, kind: 'primary', onSelect: onReload }]}
  />
</div>
