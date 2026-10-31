import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseGlb } from '@mcthaydt/automata-render-pixi3d'
import { describe, expect, it } from 'vitest'
import { PROPS } from './views.ts'

// The first slice's three static props (M3.7b part 3): The Last Light's GLBs (public/models/PROVENANCE.md), each
// read as the renderer reads it at boot: a skinned or damaged file would fail boot with `ModelInvalid`.
describe('the props', () => {
  it('names three model files, each a static mesh with no skin', () => {
    const files = new Set(PROPS.map((prop) => prop.file))
    expect(files.size).toBe(3)
    for (const file of files) {
      const bytes = readFileSync(join(import.meta.dirname, '..', 'public', file))
      const mesh = parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), file)
      expect(mesh.max[1]).toBeGreaterThan(mesh.min[1])
    }
  })
})
