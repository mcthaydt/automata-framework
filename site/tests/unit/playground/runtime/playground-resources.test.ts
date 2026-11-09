// @vitest-environment node

import type { CatalogEntry } from '@automataframework/examples-runner/catalog'
import { describe, expect, it } from 'vitest'
import { publicResource } from '../../../../playground/src/playground-resources.ts'

const entry = (id: string, imports: readonly string[]): CatalogEntry =>
  ({ id, imports, problems: [], file: `/repo/examples/${id}.ts` }) as unknown as CatalogEntry

const SOURCES: Record<string, string> = {
  'render3d-meshes':
    "new URL('../resources/models/nightstand.glb', import.meta.url); new URL('../resources/models/nightstand.bin', import.meta.url)",
  'textures-sprite': "new URL('../resources/sprites/wick-run.png', import.meta.url)",
  'audio-shared': "new URL('../resources/sounds/chime.wav', import.meta.url)",
  'render3d-sound': "new URL('../resources/sounds/chime.wav', import.meta.url)",
}
const entries = [
  entry('render3d-meshes', ['@automataframework/automata-render-pixi3d']),
  entry('render3d-sound', ['@automataframework/automata-render-pixi3d']),
  entry('textures-sprite', ['@automataframework/automata']),
  entry('audio-shared', ['@automataframework/automata']),
]
const isPublic = publicResource(entries, (e) => SOURCES[e.id] ?? '', [
  'models/nightstand.glb',
  'models/nightstand.bin',
  'models/PROVENANCE.md',
  'sprites/wick-run.png',
  'sounds/chime.wav',
])

// Review of #241: the website is public, so the files only unpublished extensions' examples use (The Last Light's
// models, drawn by render-pixi3d) never go there.
describe('publicResource', () => {
  it('leaves out files only an unpublished extension’s examples name, and their folder with them', () => {
    expect(isPublic('models/nightstand.glb')).toBe(false)
    expect(isPublic('models/nightstand.bin')).toBe(false)
    expect(isPublic('models/PROVENANCE.md')).toBe(false)
    expect(isPublic('models')).toBe(false)
  })

  it('keeps files a public example names, even when a private one names them too', () => {
    expect(isPublic('sprites/wick-run.png')).toBe(true)
    expect(isPublic('sounds/chime.wav')).toBe(true)
    expect(isPublic('sprites')).toBe(true)
  })
})
