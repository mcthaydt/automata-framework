// `subset-font` ships no types; this is the part `font-subset.ts` calls. Copied from FloorFifty
// packages/asset-contract/tools/subset-font.d.ts (ac72660).
declare module 'subset-font' {
  export default function subsetFont(
    font: Uint8Array,
    text: string,
    options?: {
      targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype'
      preserveNameIds?: readonly number[]
      variationAxes?: Readonly<Record<string, number | { min: number; max: number; default?: number }>>
    },
  ): Promise<Uint8Array>
}
