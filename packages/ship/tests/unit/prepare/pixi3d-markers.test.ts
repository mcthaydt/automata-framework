import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findPixi3d, PIXI3D_EXTRAS_MARKERS, PIXI3D_MARKERS } from '#src/prepare/pixi3d-markers.ts'

function build(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-pixi3d-'))
  mkdirSync(join(dir, 'assets'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}

describe('findPixi3d', () => {
  it('finds nothing in a 2D build', () => {
    expect(findPixi3d(build({ 'index.html': '<p>', 'assets/main.js': 'new Application()' }))).toEqual({
      core: [],
      extras: [],
    })
  })

  it.each(PIXI3D_MARKERS)('finds @pixi/3d in a script by %j', (marker) => {
    const found = findPixi3d(build({ 'assets/main.js': `throw Error("${marker}")` }))
    expect(found.core).toEqual([{ file: 'assets/main.js', marker }])
    expect(found.extras).toEqual([])
  })

  it.each(PIXI3D_EXTRAS_MARKERS)('finds @pixi/3d/extras in a script by %j', (marker) => {
    expect(findPixi3d(build({ 'assets/x.js': `"${marker}"` })).extras).toEqual([
      { file: 'assets/x.js', marker },
    ])
  })

  it('reads inline scripts in an HTML page too (review of #241)', () => {
    const page = `<script type="module">throw Error("${PIXI3D_MARKERS[0]}")</script>`
    expect(findPixi3d(build({ 'index.html': page })).core).toEqual([
      { file: 'index.html', marker: PIXI3D_MARKERS[0] },
    ])
  })

  it('reads scripts only: a marker in an image or a text file is not code', () => {
    expect(findPixi3d(build({ 'assets/a.txt': PIXI3D_MARKERS[0] ?? '' })).core).toEqual([])
  })
})
