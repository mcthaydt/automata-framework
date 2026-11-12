<!--
  The suite's switcher. It chooses how the editors are drawn from the room the shell has: the sidebar (wide) or the 76 px
  rail (medium), both `Sidebar`, or the compact tab bar (`TabBar`), lying along the foot of a phone or standing at the left
  of one held sideways. Every layout keeps the same `tablist` named "Editors" of `tab`s named by the editor alone, one tab
  stop, arrows, Home, End, and Cmd or Ctrl with 1 to 9.
-->
<script lang="ts">
import Sidebar from '../../../shared/kit/nav/Sidebar.svelte'
import TabBar from '../../../shared/kit/nav/TabBar.svelte'
import type { SuiteEntry } from './suite-entries'

interface Props {
  entries: readonly SuiteEntry[]
  current: string | undefined
  /** How the shell draws the rail; `orientation` alone cannot tell the sidebar from the medium rail. */
  presentation: 'sidebar' | 'rail' | 'tabbar'
  /** Whether the compact bar stands at the left edge (a phone held sideways). */
  standing?: boolean
  game?: { readonly name: string; readonly letter: string }
  /** Problems per editor id. */
  counts?: Readonly<Record<string, number>>
  onselect: (id: string) => void
  onhome?: () => void
}

const {
  entries,
  current,
  presentation,
  standing = false,
  game = { name: 'Your game', letter: 'Y' },
  counts = {},
  onselect,
  onhome = () => {},
}: Props = $props()
</script>

{#if presentation === 'tabbar'}
  <TabBar {entries} {current} {counts} {standing} {onselect} />
{:else}
  <Sidebar {game} {entries} {current} {counts} layout={presentation} {onselect} {onhome} />
{/if}
