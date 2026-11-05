// The one failure of `resolveExtensions`.

interface ExtensionErrorFields {
  readonly reason: 'duplicate' | 'missing' | 'cycle' | 'manifest-field'
  /**
   * - duplicate: the repeated name.
   * - missing: who needs it, then what is missing.
   * - cycle: the loop, starting at its smallest name and following `requires`.
   * - manifest-field: the extension, then the field Ruken's manifest does not have.
   */
  readonly names: readonly string[]
}

/** A bad extension list. Thrown, not returned, so a game's Vite build fails with `message`. */
export class ExtensionError extends Error {
  readonly _tag = 'ExtensionError' as const
  readonly reason: ExtensionErrorFields['reason']
  readonly names: readonly string[]

  constructor(fields: ExtensionErrorFields) {
    super(`${fields.reason}: ${fields.names.join(', ')}`)
    this.name = 'ExtensionError'
    this.reason = fields.reason
    this.names = fields.names
  }
}
