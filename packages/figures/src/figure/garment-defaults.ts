// The swatches a garment wears where its file names none: a shoe's sole, the face's lids, brows and mouth, a
// zip's teeth, a jacket's hardware. One table, read by the builders (garments/, streetwear/) and by the garment
// schema, which writes each default into the compiled garment as a reference, so a game library that lacks one
// fails content compile at the garment instead of build() throwing at run time (M3.5b review). The ids are
// FigureBuilder's (mcthaydt/FigureBuilder, a1f7246) defaults in AF's kebab-case; the shades' frame, its crew's
// `jetBlack`, is the library's `black`.

type Ids<K extends string> = { readonly [F in K]: string }
export const GARMENT_DEFAULTS: {
  readonly shoes: Ids<'sole'>
  readonly eyes: Ids<'lids' | 'brows' | 'mouth'>
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
  shoes: { sole: 'sole' },
  eyes: { lids: 'lid', brows: 'brow', mouth: 'mouth' },
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
