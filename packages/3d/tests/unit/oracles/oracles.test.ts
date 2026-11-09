import { describe, expect, it } from 'vitest'
import { environmentBuilderLook, figureBuilderFrames } from '#src/testing/oracles.ts'

describe('the oracles', () => {
  it('the FigureBuilder fixtures name their source commit and parse', () => {
    const { source, frames } = figureBuilderFrames()
    expect(source).toBe('FigureBuilder 025ffb4')
    expect(frames).toHaveLength(12)
    for (const f of frames) {
      expect(f.soup.triCount, f.id).toBeGreaterThan(0)
      expect(f.soup.verts.length, f.id).toBeGreaterThanOrEqual(f.soup.count * 9)
      expect(f.soup.tris.length, f.id).toBeGreaterThanOrEqual(f.soup.triCount * 6)
      expect(f.md5, f.id).toMatch(/^[0-9a-f]{32}$/)
    }
    // Both members at both densities, with a back view, a walk and the hero among them.
    expect(new Set(frames.map((f) => `${f.member}-D${f.density}`)).size).toBe(4)
    expect(frames.some((f) => f.motion.moving)).toBe(true)
  })

  it('records the frame that loses an eye as the sources draw it today', () => {
    const lost = figureBuilderFrames().frames.filter((f) => f.f13)
    expect(lost.map((f) => f.id)).toEqual(['base-m-D1-hero'])
  })

  it('the EnvironmentBuilder fixtures name their source commit and parse', () => {
    const look = environmentBuilderLook()
    expect(look.source).toBe('EnvironmentBuilder 6d82a52')
    for (const [scene, time] of [
      ['base-interior', 'lampLit'],
      ['base-exterior', 'day'],
    ] as const) {
      const points = look.vertexLight.filter((p) => p.scene === scene)
      expect(points, scene).toHaveLength(200)
      expect(new Set(points.map((p) => p.time))).toEqual(new Set([time]))
    }
    expect(look.shade).toHaveLength(500)
    expect(look.spriteLight).toHaveLength(2)
    for (const cell of look.spriteLight) {
      expect(cell.painted.length).toBe(cell.w * cell.h * 4)
      expect(cell.normals.length).toBe(cell.w * cell.h * 4)
      expect(cell.lit.length).toBe(cell.w * cell.h * 4)
    }
    const swatches = new Set(look.tiles.map((t) => t.swatch))
    expect([...swatches].sort()).toEqual(['asphalt', 'brickRed', 'oakFloor'])
    expect(look.tiles).toHaveLength(9)
  })
})
