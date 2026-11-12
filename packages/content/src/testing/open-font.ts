import { create, type Font } from 'fontkit'

/** A font file opened for a test to read its names: fontkit's `name` table is real but not in its types. */
export type NamedFont = Font & {
  readonly name: { readonly records: Readonly<Record<string, Readonly<Record<string, string>>>> }
}

/** Opens one font (a collection is not what a subset is) from its bytes. */
export function openFont(bytes: Uint8Array): NamedFont {
  return create(Buffer.from(bytes)) as NamedFont
}
