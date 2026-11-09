// Writes the painter's oracle from a FigureBuilder checkout: twelve posed frames of the base pair (their triangle soups,
// decals, face and hand stamps, the materials, the motion state their pose came from) and the md5 of each painted cell,
// plus four cells as PNG. Run once in a checkout of FigureBuilder at the commit named in the README, never by the tests:
//
//   cd <FigureBuilder at 025ffb4> && npx vite-node <this file> -- --out <AF>/packages/3d/tests/fixtures/oracles/figurebuilder-025ffb4
//
// `soupOf` and the soup the last raster used are private to FigureBuilder's `Figure`, so the script reads a copy of
// `figure.ts` with one export and one tap added (written next to it and removed afterwards); no FigureBuilder file is edited.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createCanvas, ImageData } from '@napi-rs/canvas'

const root = process.cwd()
const outFlag = process.argv.indexOf('--out')
const out = resolve(outFlag >= 0 ? (process.argv[outFlag + 1] ?? '') : '')
if (!out || outFlag < 0) throw new Error('give --out <directory>')
if (!existsSync(join(root, 'src/features/figure/figure.ts')))
  throw new Error('run this in a FigureBuilder checkout')

// The shim: the source plus an export and a tap on the two values a frame is made of.
const figurePath = join(root, 'src/features/figure/figure.ts')
const shimPath = join(root, 'src/features/figure/figure.oracle-shim.ts')
let source = readFileSync(figurePath, 'utf8')
const tapSoup = 'this.soup = soup;'
const tapMotion = 'const st = this.motion(input, idleT, phase, this.shown, rel, faceT);'
if (!source.includes(tapSoup) || !source.includes(tapMotion))
  throw new Error('figure.ts is not the commit this oracle reads')
source = source.replace(tapSoup, `${tapSoup} (this as any).tapSoup = { soup, decals, faceState };`)
source = source.replace(tapMotion, `${tapMotion} (this as any).tapMotion = { ...st };`)
writeFileSync(shimPath, `${source}\nexport { soupOf };\n`)

const toUrl = (p: string): string => `file://${p}`
const shim = await import(toUrl(shimPath))
const { BASE } = await import(toUrl(join(root, 'base/base.ts')))
const { memberOf, standOf } = await import(toUrl(join(root, 'src/features/figure/cast.ts')))
const { evaluate } = await import(toUrl(join(root, 'src/features/motion/motion.ts')))
const { NECK } = await import(toUrl(join(root, 'src/features/outfit/garments.ts')))
const { VERT, TRI } = await import(toUrl(join(root, 'src/features/paint/raster.ts')))

const Figure = shim.Figure as new (member: unknown) => any
const md5 = (b: Uint8ClampedArray | Uint8Array): string => createHash('md5').update(b).digest('hex')
/** The cell as its texels read: FigureBuilder reuses one buffer, so an empty texel keeps the colour of an earlier paint
 * under its alpha 0; that colour is not part of the cell, so it is zeroed before the hash. */
function texels(painted: Uint8ClampedArray): Uint8ClampedArray {
  const out = painted.slice()
  for (let o = 0; o < out.length; o += 4) if (out[o + 3] === 0) out[o] = out[o + 1] = out[o + 2] = 0
  return out
}
const view = (pitch = (18 * Math.PI) / 180) => ({ azimuth: 0, pitch })
const bytesOf = (a: Float32Array | Int32Array): Uint8Array =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength)

interface Capture {
  id: string
  member: string
  density: number
  yaw: number
  pitch: number
  cell: [number, number]
  feet: [number, number]
  metres: number
  facing: number
  hand: 'L' | 'R'
  kind: string
  decals: unknown
  face: unknown
  hands: unknown
  materials: unknown
  materialIndex: [string, number][]
  bends: unknown
  neck: number[]
  skin: number
  supersample: number
  motion: unknown
  f13: boolean
  md5: string
  soupVerts: number
  soupTris: number
}

/** The twelve frames the oracle keeps: sixteen soups would be 21 MiB, and these cover both densities, a back view, a walk and the hero. */
const KEPT = new Set(['D1-stand-45', 'D1-stand-180', 'D1-hero', 'D2-stand-45', 'D2-walk3-90', 'D2-hero'])

const captures: Capture[] = []
const blobs: Uint8Array[] = []
let offset = 0
const png: { id: string; rgba: Uint8ClampedArray; w: number; h: number }[] = []

/** Turns a Figure's last raster into a record, and appends the soup to the blob. */
function record(id: string, kind: string, baseId: string, density: number, f: any, facing: number): void {
  if (!KEPT.has(id.replace(/^base-[mf]-/, ''))) return
  const tap = f.tapSoup
  const soup = tap.soup
  const verts = soup.verts.slice(0, soup.count * VERT)
  const tris = soup.tris.slice(0, soup.triCount * TRI)
  const [w, h] = f.cell
  const face = f.faceStamp
  const eyes = eyesIn(f.painted, w, face)
  const entry: Capture = {
    id,
    member: baseId,
    density,
    yaw: f.relativeYaw,
    pitch: f.pitch,
    cell: [w, h],
    feet: [w / 2, h - f.feet],
    metres: f.metres,
    facing,
    hand: f.member.hand,
    kind,
    decals: tap.decals,
    face: face && { ...face, mood: [...(face.mood ?? [])] },
    hands: f.handStamps,
    materials: f.built.materials,
    materialIndex: [...f.built.materialIndex.entries()],
    bends: f.bends(),
    neck: f.built.parts.flatMap((p: any, i: number) => (p.tag === NECK ? [p.seam ?? i] : [])),
    skin: f.built.materialIndex.get(f.member.skin) ?? -1,
    supersample: f.style.supersample,
    motion: f.tapMotion ?? null,
    f13: face !== null && Math.abs(face.view) <= 1 && eyes < 2,
    md5: md5(texels(f.painted)),
    soupVerts: soup.count,
    soupTris: soup.triCount,
  }
  blobs.push(bytesOf(verts), bytesOf(tris))
  ;(entry as any).vertOffset = offset
  offset += verts.byteLength
  ;(entry as any).triOffset = offset
  offset += tris.byteLength
  captures.push(entry)
  if (['base-m-D2-hero', 'base-f-D2-hero', 'base-m-D1-stand-45', 'base-f-D2-walk3-90'].includes(id)) {
    png.push({ id, rgba: f.painted.slice(), w, h })
  }
}

/** How many of the face's two eyes show a mark of the drawn eye (iris, lash or white) within a texel box of where it goes. */
function eyesIn(painted: Uint8ClampedArray, width: number, face: any): number {
  if (!face || Math.abs(face.view) > 1) return 0
  const marks = new Set<number>([face.iris, face.lash, face.white])
  let seen = 0
  for (const [ex, ey] of face.eyes as [number, number][]) {
    let found = false
    for (let y = Math.round(ey) - 1; y <= Math.round(ey) + 1 && !found; y++) {
      for (let x = Math.round(ex) - 2; x <= Math.round(ex) + 2 && !found; x++) {
        const o = (y * width + x) * 4
        if (painted[o + 3] === 0) continue
        if (marks.has((painted[o] << 16) | (painted[o + 1] << 8) | painted[o + 2])) found = true
      }
    }
    if (found) seen++
  }
  return seen
}

for (const base of BASE as { def: { id: string }; pose?: string }[]) {
  for (const density of [1, 2]) {
    const cast = memberOf(base.def, density)
    const tag = `${base.def.id}-D${density}`
    // Standing, at 45° and 180° from the camera, after three updates (the sheets' own settle).
    for (const [name, facing] of [
      ['stand-45', Math.PI / 4],
      ['stand-180', Math.PI],
    ] as const) {
      const f = new Figure(cast)
      f.cache = false
      for (let i = 0; i < 3; i++) f.update(1 / 60, { facing, moving: false, view: view() })
      record(`${tag}-${name}`, 'stand', base.def.id, density, f, facing)
    }
    // The walk's pose 3, three-quarter turned to 90°, after the hair's spring has settled (frames.ts walking).
    {
      const f = new Figure({ ...cast, blink: 0 })
      f.cache = false
      const dt = 1 / 60
      let phase = 0
      let kept = false
      for (let i = 0; i < Math.round(cast.gait.cycle * 4 * 60) && !kept; i++) {
        phase = (phase + dt / cast.gait.cycle) % 1
        f.update(dt, { facing: Math.PI / 2, moving: true, view: view() })
        if (Math.floor(phase * cast.gait.walkPoses) === 3 && i > cast.gait.cycle * 3 * 60) {
          record(`${tag}-walk3-90`, 'walk', base.def.id, density, f, Math.PI / 2)
          kept = true
        }
      }
      if (!kept) throw new Error(`${tag}: no walk pose 3`)
    }
    // The hero: the base pair's lookbook stand as a made pose, facing 45° (frames.ts hero).
    {
      const f = new Figure(cast)
      f.cache = false
      const facing = Math.PI / 4
      const input = { facing, moving: false, view: view() }
      const s = f.skeleton
      const look = cast.outfits[cast.defaultOutfit](s)
      const placed = base.pose ? standOf(s, look, base.pose) : null
      if (!placed) throw new Error(`${tag}: no stand ${base.pose}`)
      const rel = Math.round((facing - input.view.azimuth) / (Math.PI / 4)) * (Math.PI / 4)
      const st = {
        ...f.motion(input, 0, 0, facing, rel),
        yaw: 0,
        view: rel,
        stand: placed.stand,
        holds: placed.holds,
      }
      f.update(1 / 60, { ...input, pose: { key: 'hero', pose: evaluate(s, cast.gait, st).pose } })
      // The made pose's own state (its stand and holds are the pose, kept by name, not copied).
      const { stand: _stand, holds: _holds, ...state } = st
      f.tapMotion = { ...state, stand: base.pose ?? null }
      record(`${tag}-hero`, 'hero', base.def.id, density, f, facing)
    }
  }
}

rmSync(shimPath)
mkdirSync(join(out, 'cells'), { recursive: true })
const blob = new Uint8Array(offset)
let at = 0
for (const b of blobs) {
  blob.set(b, at)
  at += b.byteLength
}
writeFileSync(join(out, 'soups.bin.gz'), gzipSync(blob, { level: 9 }))
writeFileSync(
  join(out, 'frames.json'),
  `${JSON.stringify({ source: 'FigureBuilder 025ffb4', vert: VERT, tri: TRI, frames: captures }, null, 1)}\n`,
)
for (const p of png) {
  const canvas = createCanvas(p.w * 4, p.h * 4)
  const ctx = canvas.getContext('2d')
  const small = createCanvas(p.w, p.h)
  small.getContext('2d').putImageData(new ImageData(p.rgba, p.w, p.h), 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(small, 0, 0, p.w * 4, p.h * 4)
  writeFileSync(join(out, 'cells', `${p.id}.png`), canvas.toBuffer('image/png'))
}
console.log(
  `${captures.length} frames, ${(blob.byteLength / 1024 / 1024).toFixed(1)} MiB of soups; f13: ${
    captures
      .filter((c) => c.f13)
      .map((c) => c.id)
      .join(', ') || 'none'
  }`,
)
