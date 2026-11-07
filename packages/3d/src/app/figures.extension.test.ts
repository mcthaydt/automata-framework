import { describe, expect, it } from 'vitest'
import { figuresExtension } from './figures.extension.ts'

describe('figuresExtension', () => {
  it('registers the figure kinds and the seven libraries, the poses and the clips, none of them for the sim', () => {
    expect(figuresExtension.name).toBe('figures')
    const content = figuresExtension.content ?? []
    expect(content.map((kind) => kind.kind).sort()).toEqual([
      'figure',
      'figure-clip',
      'figure-gait',
      'figure-hair',
      'figure-headwear',
      'figure-item',
      'figure-pose',
      'figure-rig',
      'figure-stand',
      'figure-swatch',
    ])
    for (const kind of content) expect(kind.sim, kind.kind).toBe(false)
  })
})
