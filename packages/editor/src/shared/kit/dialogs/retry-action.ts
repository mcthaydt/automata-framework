import type { FolderStore } from '../storage/folder'
import type { ProjectStore, StorageFailure } from '../storage/project-store'
import type { ToastAction, ToastStore } from '../widgets/toasts'

// The action a failed save offers (plan ED2D.4c2b, decision 6; moved from editor-2d in ED3D.5c; kit spec §6): Retry, or Re-grant when the workspace is
// a folder the person picked and its permission has lapsed. A folder's permission can only be asked for again from a
// user gesture, which is why this is a button on the toast and never automatic. Nothing is lost either way: the edits
// stay in the history.

const isFolderStore = (store: ProjectStore): store is FolderStore =>
  store.kind === 'folder' && 'requestAccess' in store

export function retryAction(options: {
  readonly store: ProjectStore
  readonly reason: StorageFailure
  readonly toasts: ToastStore
  readonly retry: () => Promise<void>
}): ToastAction {
  const { store, reason, toasts, retry } = options
  if (reason !== 'denied' || !isFolderStore(store)) return { label: 'Retry', run: () => void retry() }
  return {
    label: 'Re-grant',
    run: () =>
      void (async () => {
        if (await store.requestAccess()) await retry()
        else
          toasts.push({
            kind: 'error',
            message: `Access to ${store.name} was not granted. Nothing was lost: your edits are still here.`,
          })
      })(),
  }
}
