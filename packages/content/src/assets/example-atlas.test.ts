import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildAtlases } from './build-atlases'

// G-c on real inputs (M5.6 plan step 8): the examples' atlas, built again from its frames, is byte for byte the
// committed `examples/public/textures/atlas/` (served beside the page) that `textures/textures-atlas.ts` draws. It lives here, not beside the
// example, because a file in an examples module folder is an example.
const EXAMPLES = join(import.meta.dirname, '../../../../examples')

describe("the examples' atlas", () => {
  it('is fresh: rebuilding it gives the committed bytes', async () => {
    const { files } = await Effect.runPromise(buildAtlases(EXAMPLES))
    expect([...files.keys()]).toEqual(['wick-0.json', 'wick-0.png'])
    for (const [name, bytes] of files)
      expect(new Uint8Array(readFileSync(join(EXAMPLES, 'public/textures/atlas', name))), name).toEqual(bytes)
  })
})
