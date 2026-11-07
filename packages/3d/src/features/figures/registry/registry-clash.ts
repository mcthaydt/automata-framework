// What every registry throws when a name is registered twice. The message names the thing and the name, so whoever
// reads a failed start knows which extension to look at; a registry never lets the second one win quietly.

export class RegistryClash extends Error {
  /** What was registered twice: "garment", "hair piece", "hair finish", "fabric" or "outfit hooks". */
  readonly what: string
  /** The name that was taken. */
  readonly subject: string

  constructor(what: string, name: string, message = `A ${what} called "${name}" is already registered`) {
    super(message)
    this.name = 'RegistryClash'
    this.what = what
    this.subject = name
  }
}
