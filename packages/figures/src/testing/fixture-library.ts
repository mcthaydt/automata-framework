// The fixture content (testing/fixtures/content) compiled once and handed to build(): its libraries and its
// two figures, for the build and random-character tests.

import type { FigureLibrary } from '../build/build'
import type { FigureDef } from '../figure/figure.schema'
import { compileFixture } from './compile-fixture'

export interface FixtureFigures {
  readonly library: FigureLibrary
  readonly figures: Readonly<Record<string, FigureDef>>
}

let compiled: Promise<FixtureFigures> | undefined

/** The compiled fixture's libraries and figures (compiled on first use, then shared by the test file). */
export function fixtureFigures(): Promise<FixtureFigures> {
  compiled ??= compileFixture().then((result) => {
    if (!result.ok) throw new Error(result.message)
    const data = result.content.data as Record<string, Record<string, unknown>>
    const kind = <T>(name: string) => (data[name] ?? {}) as Readonly<Record<string, T>>
    return {
      library: {
        swatches: kind('figure-swatch'),
        hair: kind('figure-hair'),
        headwear: kind('figure-headwear'),
        items: kind('figure-item'),
      },
      figures: kind<FigureDef>('figure'),
    }
  })
  return compiled
}
