import { describe, expect, it } from 'vitest'
import { figuresExtension } from './figures.extension'

describe('figuresExtension', () => {
  it('registers the figure kinds and the seven libraries and the poses, none of them for the sim', () => {
    expect(figuresExtension.name).toBe('figures')
    const content = figuresExtension.content ?? []
    expect(content.map((kind) => kind.kind).sort()).toEqual([
      'figure',
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
