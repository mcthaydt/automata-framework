<!--
  The Share menu in the top bar, shown only where Save does not write the game (browser storage, the site's try-it),
  where it is the bar's one primary action, the icon with its word: Download, Share and Copy the level's file as it
  stands now. Each says how it went in a toast. What leaves is the host's (`share`, over `share-model`); where the
  device keeps no copy, the host's `onleft` counts a file that left as saved.
-->
<script lang="ts">
import Icon from '../../shared/kit/icons/Icon.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import type { ToastStore } from '../../shared/kit/widgets/toasts'
import { type ShareAction, type ShareOutcome, shareItems } from './share-model'

interface Props {
  /** The device has a share sheet. */
  canShare: boolean
  /** Hands the level over; `undefined` when there is nothing to hand over. */
  share: (action: ShareAction) => Promise<ShareOutcome | undefined>
  toasts: ToastStore
  /** After a file left. */
  onleft?: (() => void) | undefined
}

const { canShare, share, toasts, onleft }: Props = $props()

async function run(action: string): Promise<void> {
  const outcome = await share(action as ShareAction)
  if (outcome === undefined) return
  toasts.push({ kind: outcome.ok ? 'ok' : 'error', message: outcome.message })
  if (outcome.ok) onleft?.()
}
</script>

<Menu label="Share" variant="primary" items={shareItems(canShare)} onselect={(action) => void run(action)}>
  {#snippet trigger()}<Icon name="share" size={16} />Share{/snippet}
</Menu>
