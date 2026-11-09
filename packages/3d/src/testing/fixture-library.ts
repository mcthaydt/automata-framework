// The fixture content (tests/fixtures/content) compiled once and handed to build(): its libraries and its
// two figures, for the build, random-character and motion tests.

import type { Gait } from '../features/figures/content/gait.schema.ts'
import type { Stand } from '../features/figures/content/stand.schema.ts'
import type { FigureLibrary } from '../features/figures/figure/build.ts'
import type { FigureDef } from '../features/figures/figure/figure.schema.ts'
import { compileFixture } from './compile-fixture.ts'

export interface FixtureFigures {
  readonly library: FigureLibrary
  readonly figures: Readonly<Record<string, FigureDef>>
  readonly gaits: Readonly<Record<string, Gait>>
  readonly stands: Readonly<Record<string, Stand>>
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
      gaits: kind<Gait>('figure-gait'),
      stands: kind<Stand>('figure-stand'),
    }
  })
  return compiled
}
