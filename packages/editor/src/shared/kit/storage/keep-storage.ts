// A browser may clear a site's files when the device runs short of space, unless the site asked to keep them. The first
// write of a page asks once; the answer is not shown, since it changes nothing the person does.

/** The part of `navigator.storage` this uses. */
export interface PersistentStorage {
  persisted?(): Promise<boolean>
  persist?(): Promise<boolean>
}

/** A function that asks to keep the storage the first time it is called, and does nothing after. */
export function keepStorage(
  storage: PersistentStorage | undefined = typeof navigator === 'undefined' ? undefined : navigator.storage,
): () => Promise<void> {
  let asked = false
  return async () => {
    if (asked) return
    asked = true
    try {
      if (storage?.persist === undefined) return
      if ((await storage.persisted?.()) === true) return
      await storage.persist()
    } catch {
      // A refusal or a missing call changes nothing the person can do.
    }
  }
}
