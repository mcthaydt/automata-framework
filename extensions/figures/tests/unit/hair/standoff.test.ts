// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 25 of the builders-fold plan (the strict flags) replaces each with a check
import { describe, expect, it } from 'vitest'
import { BASE } from '#src/shared/base/base-pair.ts'
import { measure, type Sliders } from '#src/shared/body/genes.ts'
import { GROUP, type Part, reach } from '#src/shared/body/parts.ts'
import { skeleton } from '#src/shared/body/rig.ts'
import type { CharacterDef } from '#src/shared/figure/cast.ts'
import { standOf } from '#src/shared/figure/cast.ts'
import { Figure } from '#src/shared/figure/figure.ts'
import { member, SPRITE_PITCH, view } from '#src/shared/figure/frames.ts'
import type { HairStyle } from '#src/shared/hair/hair.ts'
import { evaluate, type Stand } from '#src/shared/motion/motion.ts'
import { POSES } from '#src/shared/motion/presets.ts'
import type { Garment } from '#src/shared/outfit/garments.ts'
import { differs, dressed } from '../../fixtures/draw'
import { FALL_PLAIN } from '../../fixtures/pins'

/**
 * The stand-off model (hair.ts, `Fall.rest`): long hair that lies on the trunk stays put when the head pitches or cocks.
 * With `rest: 'trunk'`, a clump's points below the shoulder ride the chest, those between the jaw and the shoulder blend,
 * and the hair bones' swing fades out by the shoulder. Drawn on both base figures in a long fall (to 1.6, half of it in
 * front), posed by a held stand's head (pitch ±0.4, roll ±0.3 rad), by a tilted head, a drooping posture and a loose hair spring
 * (the case that looped: the hair bones roll against the tilt and trail in a walk), standing and over a walk.
 */
const FALL = { front: 0.5, length: 1.6 }
const TILTED: Partial<Sliders> = { headTilt: 15, posture: 0.52 }
const SPRING = { stiff: 14, damp: 2.6, trail: 0.55, bounce: 0.02 }
const wear = (
  i: number,
  rest?: 'head' | 'trunk',
  sliders: Partial<Sliders> = {},
  spring?: typeof SPRING,
): CharacterDef => {
  const def = BASE[i].def,
    pieces = [
      { fall: { ...(FALL_PLAIN.pieces[0] as { fall: object }).fall, ...FALL, ...(rest ? { rest } : {}) } },
    ]
  const style = { ...FALL_PLAIN, pieces } as HairStyle,
    outfit = def.outfits.base.map((g: Garment) => ('hair' in g ? { ...g, style } : g))
  return {
    ...dressed(outfit as Garment[], undefined, def),
    sliders: { ...def.sliders, ...sliders },
    ...(spring ? { hair: spring } : {}),
  }
}

type Internals = { world: number[][]; built: { parts: Part[] } }
/** A part's vertices after the pose (skinning as figure.ts soupOf does it), in figure space. */
function posed(f: Figure, part: Part): number[] {
  const { world } = f as unknown as Internals,
    pos = part.mesh.positions,
    out: number[] = []
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i],
      y = pos[i + 1],
      z = pos[i + 2]
    const apply = (m: number[]) => [
      m[0] * x + m[1] * y + m[2] * z + m[9],
      m[3] * x + m[4] * y + m[5] * z + m[10],
      m[6] * x + m[7] * y + m[8] * z + m[11],
    ]
    if (part.bone !== undefined) {
      out.push(...apply(world[part.bone]))
      continue
    }
    let qx = 0,
      qy = 0,
      qz = 0
    for (const [bone, w] of part.skin![i / 3])
      if (w) {
        const q = apply(world[bone])
        qx += w * q[0]
        qy += w * q[1]
        qz += w * q[2]
      }
    out.push(qx, qy, qz)
  }
  return out
}
/** A figure after `frames` updates, in a hold of the head (`held`) or standing, or walking. */
function pose(def: CharacterDef, how: { head?: [number, number, number]; walk?: boolean; frames?: number }) {
  const cast = member(def, 2),
    f = new Figure(cast),
    input = { facing: 0, moving: !!how.walk, view: view() }
  if (how.head) {
    const name = `c9Head${how.head.join('_')}`
    POSES[name] = { weight: 'L', shift: 0, roll: 0, free: [0, 0], head: how.head } as Stand
    const s = f.skeleton,
      look = cast.outfits[cast.defaultOutfit](s),
      placed = standOf(s, look, name)!
    const st = { ...f.motion(input, 0, 0, 0, 0), yaw: 0, view: 0, stand: placed.stand, holds: placed.holds }
    for (let i = 0; i < (how.frames ?? 3); i++)
      f.update(1 / 60, { ...input, pose: { key: name, pose: evaluate(s, cast.gait, st).pose } })
  } else for (let i = 0; i < (how.frames ?? 3); i++) f.update(1 / 60, input)
  return f
}
/** The signed gap along z from a point to the trunk's nearest surface in its direction (front if it is ahead of the trunk's middle, else back); NaN where the trunk is not. */
function gap(trunk: Part[], x: number, y: number, z: number): number {
  const ahead = reach(trunk, [], [x, y, 0], [0, 0, 1]),
    behind = reach(trunk, [], [x, y, 0], [0, 0, -1])
  if (!(ahead > 0 && behind > 0)) return NaN
  return z >= 0 ? z - ahead : -z - behind
}
const TEXEL = 1 / 73.8
/** What the hair does below the shoulder in a pose: the deepest it goes into the trunk (m, 0 if none) and how much further from it than at rest it hangs (m, 0 if none). */
function stray(f: Figure, def: CharacterDef) {
  const m = measure(def.sliders),
    s = skeleton(m.genes),
    { built } = f as unknown as Internals
  const rest = built.parts.filter((p) => p.group === GROUP.torso),
    hair = built.parts.filter((p) => p.skin && p.seam !== undefined && p.seam >= 2000 && p.seam < 3000)
  const trunk = rest.map(
    (p) => ({ ...p, bone: undefined, skin: undefined, mesh: { ...p.mesh, positions: posed(f, p) } }) as Part,
  )
  let into = 0,
    away = 0
  for (const p of hair) {
    const now = posed(f, p)
    // Every fifth vertex: the rays are the cost, and a rope's rings are a few millimetres apart.
    for (let i = 0; i < p.mesh.positions.length; i += 15) {
      if (p.mesh.positions[i + 1] > s.shoulderY - 0.02) continue
      const g0 = gap(rest, p.mesh.positions[i], p.mesh.positions[i + 1], p.mesh.positions[i + 2]),
        g1 = gap(trunk, now[i], now[i + 1], now[i + 2])
      if (Number.isNaN(g0) || Number.isNaN(g1)) continue
      into = Math.max(into, -g1)
      away = Math.max(away, g1 - Math.max(g0, 0))
    }
  }
  return { into, away }
}
/** Whether every transparent texel of a cell in the upper body (above the hips' row) is reached from the border through transparent texels. */
function holes(f: Figure, upTo: number): number {
  const [w, h] = f.cell,
    px = f.painted,
    seen = new Uint8Array(w * h),
    queue: number[] = []
  const open = (k: number) => px[k * 4 + 3] === 0
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1])
      if (open(y * w + x)) {
        seen[y * w + x] = 1
        queue.push(y * w + x)
      }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1])
      if (open(y * w + x) && !seen[y * w + x]) {
        seen[y * w + x] = 1
        queue.push(y * w + x)
      }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i],
      x = k % w,
      y = (k - x) / w
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx,
        yy = y + dy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
      const q = yy * w + xx
      if (!seen[q] && open(q)) {
        seen[q] = 1
        queue.push(q)
      }
    }
  }
  let n = 0
  for (let y = 0; y < upTo; y++) for (let x = 0; x < w; x++) if (open(y * w + x) && !seen[y * w + x]) n++
  return n
}
const ANGLES: [number, number, number][] = []
for (const pitch of [-0.4, 0, 0.4]) for (const roll of [-0.3, 0, 0.3]) ANGLES.push([0, roll, pitch])

describe('long hair that rests on the trunk', () => {
  it("rest: head and rest absent are the same cell (today's skinning)", () => {
    for (const i of [0, 1])
      expect(differs(pose(wear(i, 'head'), {}).painted, pose(wear(i), {}).painted)).toBe(false)
  })
  it('rest: trunk changes the cell where the head pitches (and has the same hair where nothing moves)', () => {
    for (const i of [0, 1])
      expect(
        differs(
          pose(wear(i, 'trunk'), { head: [0, 0.3, 0.4] }).painted,
          pose(wear(i, 'head'), { head: [0, 0.3, 0.4] }).painted,
        ),
      ).toBe(true)
  })
  // One test per figure and angle (and, below, per block of the walk): each ray-cast pass takes seconds, and the
  // whole of a figure's angles or walk in one test came near the runner's per-test limit on a loaded machine.
  for (const i of [0, 1])
    for (const head of ANGLES) {
      it(`${BASE[i].def.id}: with the head pitched and rolled (${head}), no hair below the shoulder enters the trunk or hangs more than two texels further from it than at rest, and no hole is enclosed`, () => {
        const hip = (def: CharacterDef, f: Figure) =>
          Math.floor(f.cell[1] - f.feet - skeleton(measure(def.sliders).genes).hipY * (f.cell[1] / f.metres))
        const def = wear(i, 'trunk'),
          f = pose(def, { head }),
          s = stray(f, def)
        expect(s.into, `${head}: into the trunk`).toBeLessThanOrEqual(0.001)
        expect(s.away, `${head}: away from it`).toBeLessThanOrEqual(2 * TEXEL)
        expect(holes(f, hip(def, f)), `${head}: holes`).toBeLessThanOrEqual(
          holes(
            pose(
              dressed(
                BASE[i].def.outfits.base.filter((g: Garment) => !('hair' in g)),
                undefined,
                BASE[i].def,
              ),
              { head },
            ),
            hip(def, f),
          ),
        )
      })
    }
  it("the model fixes something real: with rest: head, the head thrown back (pitch −0.4) swings the hair out from the trunk by more than a hand's breadth, which rest: trunk holds to two texels", () => {
    // (Pitch 0.4 with a roll of 0.3, the first guess, moves the head's hair by under a texel against the trunk; the chin up is what throws it out.)
    for (const i of [0, 1]) {
      const head: [number, number, number] = [0, 0, -0.4],
        a = stray(pose(wear(i, 'head'), { head }), wear(i, 'head')),
        b = stray(pose(wear(i, 'trunk'), { head }), wear(i, 'trunk'))
      expect(a.away, `${BASE[i].def.id}: rest head, away`).toBeGreaterThan(0.1)
      expect(b.away, `${BASE[i].def.id}: rest trunk, away`).toBeLessThanOrEqual(2 * TEXEL)
    }
  })
  for (const i of [0, 1]) {
    it(`${BASE[i].def.id}: a tilted head, a drooping posture and a loose spring, standing, never lets trunk hair into the body or off it`, () => {
      const def = wear(i, 'trunk', TILTED, SPRING)
      const s0 = stray(pose(def, { frames: 90 }), def)
      expect(s0.into, 'standing: into').toBeLessThanOrEqual(0.001)
      expect(s0.away, 'standing: away').toBeLessThanOrEqual(2 * TEXEL)
    })
    // The walk is one run of frames (the spring carries over from one to the next), so each block steps the whole
    // walk from its start, which is cheap, and measures only its own thirty frames.
    for (let from = 0; from < 150; from += 30)
      it(`${BASE[i].def.id}: a tilted head, a drooping posture and a loose spring, over walk frames ${from} to ${from + 29}, never lets trunk hair into the body or off it`, () => {
        const def = wear(i, 'trunk', TILTED, SPRING)
        const walker = pose(def, { walk: true, frames: 1 })
        for (let n = 0; n < from + 30; n++) {
          walker.update(1 / 60, { facing: 0, moving: true, view: view() })
          if (n < from || n % 10) continue
          const s = stray(walker, def)
          expect(s.into, `walk ${n}: into`).toBeLessThanOrEqual(0.001)
          expect(s.away, `walk ${n}: away`).toBeLessThanOrEqual(2 * TEXEL)
        }
      })
  }
  it('is drawn in 8 views, and twice to the same texels', () => {
    for (let d = 0; d < 8; d++) {
      const a = new Figure(member(wear(1, 'trunk', TILTED, SPRING), 2)),
        b = new Figure(member(wear(1, 'trunk', TILTED, SPRING), 2))
      for (let n = 0; n < 5; n++) {
        a.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view(SPRITE_PITCH) })
        b.update(1 / 60, { facing: (d * Math.PI) / 4, moving: false, view: view(SPRITE_PITCH) })
      }
      expect(differs(a.painted, b.painted)).toBe(false)
    }
  })
})
