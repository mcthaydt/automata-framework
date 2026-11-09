<!--
  Levels 2D's place in the suite's top bar: on the try-it sample, Share, the bar's one primary action (the level has no game
  folder to be saved into, so this is how it leaves). The views (Level, Tiles) and the level picker are the breadcrumb's
  (`levels-2d-header.ts`), so the rail and the canvas never disagree about where the person is. The suite owns Undo, Redo
  and the Panel and Details toggles.
-->
<script lang="ts">
import { type ShareAction, shareItems } from '../../../features/share/share-model'
import Icon from '../../../shared/kit/icons/Icon.svelte'
import Menu from '../../../shared/kit/widgets/Menu.svelte'
import type { Levels2dSession } from './levels-2d-session'

interface Props {
  session: Levels2dSession
}

const { session }: Props = $props()

// svelte-ignore state_referenced_locally
const current = session.current
</script>

{#if $current.kind === 'open' && session.share !== undefined}
  <Menu
    label="Share"
    items={shareItems(session.options.share?.canShare ?? false)}
    onselect={(action) => void session.share?.(action as ShareAction)}
  >
    {#snippet trigger()}<Icon name="share" size={16} />Share{/snippet}
  </Menu>
{/if}
