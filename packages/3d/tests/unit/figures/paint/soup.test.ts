import { beforeAll, describe, expect, it } from 'vitest'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '#src/entries/base.ts'
import { GROUP } from '#src/features/figures/body/mesh.ts'
import { type Built, build } from '#src/features/figures/figure/build.ts'
import { skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { gaitOf } from '#src/features/figures/motion/gait-of.ts'
import { evaluateMotion } from '#src/features/figures/motion/hold.ts'
import { type Soup, TRI, VERT } from '#src/features/figures/paint/raster.ts'
import { cellSize, paintFigure, soupOf } from '#src/features/figures/paint/soup.ts'
import { type FixtureMotion, fixtureMotion } from '#src/testing/fixture-motion.ts'
import { figureBuilderFrames } from '#src/testing/oracles.ts'

let fixture: FixtureMotion
beforeAll(async () => {
  fixture = await fixtureMotion()
})

const library = { swatches: BASE_PAIR_SWATCHES, hair: {}, headwear: {}, items: {} }
const DEFS = { 'base-m': BASE_PAIR.man, 'base-f': BASE_PAIR.woman } as const
const { frames } = figureBuilderFrames()
/** The frames the oracle poses from the motion state alone: the hero's hands come from the builder's stands. */
/** The soup's triangles of one group, each as its three vertex indices. */
function trianglesOf(soup: Soup, group: number): number[][] {
  const out: number[][] = []
  for (let t = 0; t < soup.triCount; t++)
    if (soup.tris[t * TRI + 4] === group)
      out.push([soup.tris[t * TRI] ?? 0, soup.tris[t * TRI + 1] ?? 0, soup.tris[t * TRI + 2] ?? 0])
  return out
}
const BODY_GROUPS = [GROUP.torso, GROUP.armL, GROUP.armR, GROUP.legL, GROUP.legR]
const posed = frames.filter((f) => f.kind !== 'hero')

describe('the base pair stands and walks as FigureBuilder poses them', () => {
  it.each(posed)('puts $id in the same soup', (frame) => {
    const def = DEFS[frame.member]
    const body = skeleton(def)
    const built: Built = build(def, body, 'base', null, library)
    const gait = gaitOf(def, fixture.library.gaits)
    const m = frame.motion
    const { world } = evaluateMotion(body, gait, {
      t: m.t,
      moving: m.moving,
      phase: m.phase,
      yaw: frame.yaw,
      headYaw: m.headYaw,
      lookUp: m.lookUp,
      view: frame.yaw,
      pitch: m.pitch,
      shuffle: 0,
      hair: m.hair,
      clear: built.clearance,
    })
    const fig = paintFigure(def, body, built, 'base')
    const posedCell = soupOf(
      fig,
      body,
      world,
      { yaw: frame.yaw, pitch: frame.pitch, density: frame.density },
      frame.supersample,
    )
    // The body: the torso, arms and legs, triangle by triangle in part order. (The head and its hair are not compared: the
    // pair's hair is core's own locks, where the builder's is a hair-style library that left core for the character kit.)
    let compared = 0
    let worst = 0
    for (const group of BODY_GROUPS) {
      const mine = trianglesOf(posedCell.soup, group)
      const theirs = trianglesOf(frame.soup, group)
      expect(mine.length, `group ${group}`).toBe(theirs.length)
      for (let t = 0; t < mine.length; t++)
        for (let k = 0; k < 3; k++) {
          const a = (mine[t] ?? [])[k] ?? 0
          const b = (theirs[t] ?? [])[k] ?? 0
          for (let c = 0; c < VERT; c++)
            if (c !== 6)
              worst = Math.max(
                worst,
                Math.abs((posedCell.soup.verts[a * VERT + c] ?? 0) - (frame.soup.verts[b * VERT + c] ?? 0)),
              )
          compared++
        }
    }
    expect(compared).toBeGreaterThan(10000)
    expect(worst).toBeLessThan(1e-5)
    // The marks: the drawn face (its template, size, eyes, colours) and the hands, as the builder projected them.
    const want = frame.face as unknown as Record<string, unknown>
    const got = posedCell.face as unknown as Record<string, unknown>
    for (const key of ['view', 'size', 'detail', 'eye', 'iris', 'lash', 'white', 'brow'])
      expect(got[key], key).toBeCloseTo(want[key] as number, 6)
    expect(got.lips).toEqual(want.lips)
    for (const key of ['centre', 'nose', 'mouth']) {
      const at = got[key] as number[]
      for (const [i, v] of at.entries()) expect(v, key).toBeCloseTo((want[key] as number[])[i] ?? 0, 5)
    }
    expect(posedCell.hands).toHaveLength((frame.hands as unknown[]).length)
    expect(posedCell.feet).toEqual(frame.feet)
    expect(posedCell.cell).toEqual(frame.cell)
  })
})

describe('the cell', () => {
  it('is 64·D by 96·D for 2.6 m', () => {
    expect(cellSize(1)).toEqual([64, 96])
    expect(cellSize(2)).toEqual([128, 192])
    expect(cellSize(1.5)).toEqual([96, 144])
  })
})
