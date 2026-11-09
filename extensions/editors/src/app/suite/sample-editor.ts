// The editor the try-it visitor left open, kept in the browser's own storage so a reload or a returning visit opens
// there instead of on Home. Where the browser refuses storage there is no memory and nothing else changes.

const KEY = 'af-sample-editor'

export interface EditorMemory {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function rememberedEditor(storage: EditorMemory | undefined): string | undefined {
  try {
    return storage?.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** `undefined` is Home. */
export function rememberEditor(storage: EditorMemory | undefined, id: string | undefined): void {
  try {
    if (id === undefined) storage?.removeItem(KEY)
    else storage?.setItem(KEY, id)
  } catch {
    // Nothing is kept; the next visit opens on Home.
  }
}
