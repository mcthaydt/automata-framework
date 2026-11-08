// The swatches a streetwear garment wears where its file names none: a zip's teeth, a jacket's hardware, a sneaker's
// soles. One table, read by the builders and by the schemas, which write each default into the compiled garment as a
// reference, so a game library that lacks one fails content compile at the garment instead of build() throwing at
// run time. The ids are the classic defaults in AF's kebab-case; the shades'
// frame, its crew's `jetBlack`, is the library's `black`.

type Ids<K extends string> = { readonly [F in K]: string }
export const WARDROBE_DEFAULTS: {
  readonly puffer: Ids<'zip' | 'pull'>
  readonly hoodie: Ids<'aglets'>
  readonly jacket: Ids<'hardware'> & { readonly zip: readonly string[] }
  readonly bomber: Ids<'hardware'> & { readonly zip: readonly string[] }
  readonly wideLegs: Ids<'hardware'>
  readonly cargos: Ids<'hardware'>
  readonly sneakers: Ids<'sole' | 'outsole'>
  readonly chain: Ids<'links'>
  readonly shades: Ids<'frame'>
} = {
  puffer: { zip: 'chrome', pull: 'chrome' },
  hoodie: { aglets: 'chrome-dark' },
  jacket: { hardware: 'chrome-dark', zip: ['holo-cyan'] },
  bomber: { hardware: 'chrome-dark', zip: ['holo-cyan'] },
  wideLegs: { hardware: 'chrome-dark' },
  cargos: { hardware: 'chrome-dark' },
  sneakers: { sole: 'midsole', outsole: 'outsole' },
  chain: { links: 'chrome-dark' },
  shades: { frame: 'black' },
}
