import { join } from 'node:path'

/**
 * Where the showcase's imports of FigureBuilder's `src` land in the painter (`extensions/figures`), relative to the package.
 * The showcase (FigureBuilder's `demo/runway`, archived) was written against the builder's own layout; the painter keeps its
 * files by feature and shared layer, so each path it used has to be named here.
 */
export const SHOWCASE_IMPORTS: Readonly<Record<string, string>> = {
  '../../src': 'src/entries/index.ts',
  '../../src/features/body/parts': 'src/shared/body/parts.ts',
  '../../src/lib/math': 'src/shared/math/math.ts',
}

/**
 * The showcase's source with every import of the builder's `src` made an absolute file of the painter, so it registers its
 * fabrics, garments and hair on the module instance the kit's door loads. An import this table has no file for throws, naming
 * it: a path the painter moved again must stop the recorder, never silently load a second copy or nothing.
 */
export function repointShowcase(source: string, painterRoot: string): string {
  return source.replace(
    /(['"])(\.\.\/\.\.\/src(?:\/[^'"]*)?)\1/g,
    (_whole, quote: string, specifier: string) => {
      const file = SHOWCASE_IMPORTS[specifier]
      if (file === undefined)
        throw new Error(
          `The showcase imports '${specifier}', and SHOWCASE_IMPORTS (scripts/showcase-imports.ts) names no file for it`,
        )
      return `${quote}${join(painterRoot, file)}${quote}`
    },
  )
}
