// The swatches a classic garment wears where its file names none: a shoe's sole, the face's lids, brows and
// mouth. One table, read by the builders (garments/) and by the garment schema, which writes each default into
// the compiled garment as a reference, so a game library that lacks one fails content compile at the garment
// instead of build() throwing at run time (review). The ids are FigureBuilder's (mcthaydt/FigureBuilder, a1f7246) defaults in AF's kebab-case. An extension's wardrobe keeps
// its own table and writes it in with `withSwatchDefaults`.

type Ids<K extends string> = { readonly [F in K]: string }
export const GARMENT_DEFAULTS: {
  readonly shoes: Ids<'sole'>
  readonly eyes: Ids<'lids' | 'brows' | 'mouth'>
} = {
  shoes: { sole: 'sole' },
  eyes: { lids: 'lid', brows: 'brow', mouth: 'mouth' },
}
