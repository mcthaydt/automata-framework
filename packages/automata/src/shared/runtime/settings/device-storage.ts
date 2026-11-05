/**
 * Where a settings field that belongs to one device is kept. Any method may throw, as a
 * blocked or full `localStorage` does; the settings store copes with that and never falls back to the saves.
 */
export interface DeviceStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/**
 * The game frame's own `localStorage` as a device, with `prefix:` before every key so two games on one origin do
 * not meet. Undefined where merely reaching `window.localStorage` throws (blocked site data, a sandbox): the
 * settings store then holds device fields for the visit only.
 *
 * This is the declared stand-in for a host-owned device scope (Ruken request R-6), and a choice per settings field,
 * not a fallback for a denied `saves` grant.
 */
export function liveDeviceStorage(
  win: Pick<Window, 'localStorage'>,
  prefix: string,
): DeviceStorage | undefined {
  let storage: Storage
  try {
    storage = win.localStorage
  } catch {
    return undefined
  }
  return {
    get: (key) => storage.getItem(`${prefix}:${key}`),
    set: (key, value) => storage.setItem(`${prefix}:${key}`, value),
    remove: (key) => storage.removeItem(`${prefix}:${key}`),
  }
}
