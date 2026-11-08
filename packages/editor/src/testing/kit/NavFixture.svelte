<!--
  The sidebar, its folded rail or the tab bar alone in a box the size the shell gives it, for the layout tests that measure
  the switcher's own rows (the shell's tests measure the regions around it).
-->
<script lang="ts">
import Sidebar, { type NavEntry } from '../../shared/kit/nav/Sidebar.svelte'
import TabBar from '../../shared/kit/nav/TabBar.svelte'

interface Props {
  layout: 'sidebar' | 'rail' | 'tabbar'
  standing?: boolean
  /** The box's width in px: 224 for the sidebar, 76 for the rail. */
  width: number
  entries: readonly NavEntry[]
  current?: string | undefined
  counts?: Readonly<Record<string, number>>
}

const { layout, standing = false, width, entries, current, counts = {} }: Props = $props()
</script>

<div class="box" style:width={layout === 'tabbar' && !standing ? '100%' : `${width}px`} data-testid="nav-box">
  {#if layout === 'tabbar'}
    <TabBar {entries} {current} {counts} {standing} onselect={() => {}} />
  {:else}
    <Sidebar
      game={{ name: 'Rooftops', letter: 'R' }}
      {entries}
      {current}
      {counts}
      {layout}
      onselect={() => {}}
      onhome={() => {}}
    />
  {/if}
</div>

<style>
  .box {
    display: flex;
    height: 100vh;
    box-sizing: border-box;
    background: var(--tool-bg, transparent);
  }
</style>
