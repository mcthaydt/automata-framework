// The fixture figures with the kit's own content on top: core's fixture (Wick, the keeper, the swatches, three hair
// styles) plus the kit's hairstyles and seats, compiled together with the figures' kinds and the `figure-seat` kind.
// Core's `compileFixture` cannot take a folder it has no kind for, so this copies core's fixture to a folder of its own,
// lays the kit's over it, compiles that and removes the copy.

import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FIGURE_CONTENT, type FigureLibrary, type Gait } from '@automata/3d/figures'
import { FIXTURE_ROOT } from '@automata/3d/testing'
import { compileContentResult, formatDiagnostic } from '@automata/content'
// The fixture's hairstyles name the kit's pieces and finishes, so the kit is loaded for the compile to accept them.
import '../app/character-kit.extension.ts'
import { figureSeatContent } from '../features/seats/seat.content.ts'
import type { Seat } from '../features/seats/seat.schema.ts'

/** The kit's own fixture content: its hairstyles (`figure-hair`) and seats (`figure-seats`). */
const KIT_FIXTURE_ROOT: string = join(import.meta.dirname, '../../tests/fixtures')

export interface KitFixture {
  readonly library: FigureLibrary
  readonly gaits: Readonly<Record<string, Gait>>
  readonly seats: Readonly<Record<string, Seat>>
}

let compiled: Promise<KitFixture> | undefined

/** The fixture's libraries with the kit's styles in `hair`, and its seats (compiled on first use, then shared). */
export function kitFixture(): Promise<KitFixture> {
  compiled ??= compileKitFixture()
  return compiled
}

async function compileKitFixture(): Promise<KitFixture> {
  const root = mkdtempSync(join(tmpdir(), 'character-kit-fixture-'))
  try {
    cpSync(FIXTURE_ROOT, root, { recursive: true })
    cpSync(KIT_FIXTURE_ROOT, root, { recursive: true })
    const result = await compileContentResult({ root, schemas: [...FIGURE_CONTENT, figureSeatContent] })
    if (!result.ok) {
      const { error } = result
      throw new Error(
        error._tag === 'ContentCompileFailed'
          ? error.diagnostics.map(formatDiagnostic).join('\n')
          : error.message,
      )
    }
    const data = result.content.data as Record<string, Record<string, unknown>>
    const kind = <T>(name: string) => (data[name] ?? {}) as Readonly<Record<string, T>>
    return {
      library: {
        swatches: kind('figure-swatch'),
        hair: kind('figure-hair'),
        headwear: kind('figure-headwear'),
        items: kind('figure-item'),
      },
      gaits: kind<Gait>('figure-gait'),
      seats: kind<Seat>('figure-seat'),
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
