<!--
  The view switcher in the top bar: Level, Map, Tiles, Characters. From an iPad up it is the kit's segmented control
  (one tab stop, arrow keys choose, the open view checked); on a phone, where four labels do not fit beside the name
  and Save, it is the kit's menu button, named after the open view ("Level"), listing all four. Choosing a view only
  changes the view: the document, its history and its save state stay. A view chosen here remounts the top bar around
  it, so the new switcher takes the focus back (`focusCurrent`).
-->
<script lang="ts">
import { onMount } from 'svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import type { ViewDef } from '../../shared/level-2d/profiles/profile'

interface Props {
  views: readonly ViewDef[]
  current: string | undefined
  /** A phone: the switcher is a menu. */
  compact: boolean
  /** Focus the open view's option when the switcher appears. */
  focusCurrent?: boolean
  onselect: (id: string) => void
}

const { views, current, compact, focusCurrent = false, onselect }: Props = $props()

const options = $derived(views.map((view) => ({ id: view.id, label: view.label })))
const currentLabel = $derived(views.find((view) => view.id === current)?.label ?? 'Views')

let box = $state<HTMLElement>()
onMount(() => {
  if (focusCurrent) box?.querySelector<HTMLElement>('[aria-checked="true"], [aria-haspopup]')?.focus()
})
</script>

<div class="switcher" bind:this={box}>
  {#if compact}
    <Menu label={currentLabel} items={options} {onselect} />
  {:else}
    <Segmented label="Views" {options} value={current ?? ''} onedit={(event) => onselect(event.value)} />
  {/if}
</div>

<style>
  .switcher {
    display: flex;
    flex: none;
  }
</style>
