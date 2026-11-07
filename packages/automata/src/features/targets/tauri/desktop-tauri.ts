import { getCurrentWindow } from '@tauri-apps/api/window'
import { exit } from '@tauri-apps/plugin-process'
import { load } from '@tauri-apps/plugin-store'
import type { DesktopPort, StoreLike } from './hosting-tauri'

/** The store file in the app's data folder that holds the game's saves. */
export const SAVES_STORE_FILE = 'saves.json'

/**
 * The real desktop port, over Tauri's store, window and process APIs. The store saves only when the adapter
 * flushes (`autoSave: false`), so a save the game has not flushed is not half-written to disk.
 */
export function tauriDesktop(): DesktopPort {
  return {
    loadStore: async (): Promise<StoreLike> => {
      const store = await load(SAVES_STORE_FILE, { autoSave: false, defaults: {} })
      return {
        get: async (key) => {
          const value = await store.get<unknown>(key)
          return typeof value === 'string' ? value : undefined
        },
        set: (key, value) => store.set(key, value),
        delete: (key) => store.delete(key),
        keys: () => store.keys(),
        save: () => store.save(),
      }
    },
    onCloseRequested: (handler) => getCurrentWindow().onCloseRequested(handler),
    exitApp: () => exit(0),
  }
}
