/** A file a person picked: its name, its path from the picked folder down (its name when no folder was picked), its bytes. */
export interface PickedFile {
  readonly name: string
  readonly path: string
  readonly bytes: Uint8Array
}
