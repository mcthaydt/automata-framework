// The fixture content as a `MotionLibrary` (evaluate/figure-state.ts), read through the content compile, with
// Wick's figure and body: what the `evaluate` tests play.

import type { FigureClipDef } from '../clip/clip.schema'
import type { MotionLibrary } from '../evaluate/figure-state'
import type { FigureDef } from '../figure/figure.schema'
import { skeleton } from '../figure/figure-skeleton'
import type { Skeleton } from '../rig/rig'
import { compileFixture } from './compile-fixture'

export interface FixtureMotion {
  readonly library: MotionLibrary
  readonly wick: FigureDef
  readonly body: Skeleton
}

export async function fixtureMotion(): Promise<FixtureMotion> {
  const result = await compileFixture()
  if (!result.ok) throw new Error(result.message)
  const data = result.content.data as Record<string, Record<string, unknown>>
  const kind = <T>(name: string) => (data[name] ?? {}) as Readonly<Record<string, T>>
  const wick = kind<FigureDef>('figure').wick
  if (!wick) throw new Error('the fixture has no wick figure')
  return {
    library: {
      gaits: kind('figure-gait'),
      poses: kind('figure-pose'),
      clips: kind<FigureClipDef>('figure-clip'),
      items: kind('figure-item'),
      stands: kind('figure-stand'),
      rigs: kind('figure-rig'),
    },
    wick,
    body: skeleton(wick),
  }
}
