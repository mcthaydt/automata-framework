<!--
  The Share menu in the top bar, shown only where Save does not write the game (browser storage, the site's try-it):
  Download, Share and Copy the level's file as it stands now. Each says how it went in a toast. Where the device keeps
  no copy, a file that left is the only copy, so it counts as saved (the document turns clean).
-->
<script lang="ts">
import Icon from '../../kit/icons/Icon.svelte'
import type { DownloadStore } from '../../kit/storage/download-store'
import Menu from '../../kit/widgets/Menu.svelte'
import type { ToastStore } from '../../kit/widgets/toasts'
import type { OpenDocument } from '../session/editor-app-types'
import { levelFile, type ShareAction, shareItems, shareLevel } from './share-model'

interface Props {
  document: OpenDocument
  exports: DownloadStore
  /** The device keeps a copy; without one a file that left is the save. */
  persistent: boolean
  toasts: ToastStore
}

const { document: opened, exports, persistent, toasts }: Props = $props()

async function run(action: string): Promise<void> {
  const file = levelFile(opened.profile, opened.history.state, opened.base())
  if (file === undefined) return
  const outcome = await shareLevel(action as ShareAction, file, exports)
  toasts.push({ kind: outcome.ok ? 'ok' : 'error', message: outcome.message })
  if (outcome.ok && !persistent) opened.history.markClean()
}
</script>

<Menu label="Share" items={shareItems(exports.canShare)} onselect={(action) => void run(action)}>
  {#snippet trigger()}<Icon name="share" />{/snippet}
</Menu>
