// Writes the look's oracle from an EnvironmentBuilder checkout: the vertex light of the two base scenes, the colour
// pipeline's shade (lit, hazed and snapped), two figure cells lit as sprites, and the photo tiles' labels. Run once in a
// checkout of EnvironmentBuilder at the commit named in the README (its FigureBuilder submodule at the commit it pins),
// never by the tests:
//
//   cd <EnvironmentBuilder at 6d82a52> && DENSITY=2 npx vite-node <this file> -- --out <AF>/packages/3d/tests/fixtures/oracles/environmentbuilder-6d82a52
//
// EnvironmentBuilder is imported from the working directory, so no file of it is edited or copied.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createCanvas, ImageData } from '@napi-rs/canvas'

const root = process.cwd()
const outFlag = process.argv.indexOf('--out')
const out = resolve(outFlag >= 0 ? (process.argv[outFlag + 1] ?? '') : '')
if (outFlag < 0 || !out) throw new Error('give --out <directory>')
if (!existsSync(join(root, 'src/features/paint/vertex-light.ts')))
  throw new Error('run this in an EnvironmentBuilder checkout')
if (Number(process.env.DENSITY ?? 2) !== 2)
  throw new Error('run with DENSITY=2: the figure cells are density 2')

const at = (path: string): string => join(root, path)
const { checkedMap } = await import(at('base/base.ts'))
const { mapRenderer } = await import(at('src/features/view/render.ts'))
const { sectorAt } = await import(at('src/features/world/sectors.ts'))
const { strength, toCell } = await import(at('src/features/paint/light.ts'))
const { hazeOf, hazeShare, hazed, litColour, snap } = await import(at('src/features/paint/colour.ts'))
const { LOOK } = await import(at('src/features/paint/look.ts'))
const { tileOf } = await import(at('src/features/photo/textures.ts'))
const { RAMPS } = await import(at('src/lib/figure.ts'))

type V3 = [number, number, number]
const md5 = (b: Uint8Array): string => createHash('md5').update(b).digest('hex')
/** A small seeded generator (mulberry32), so the sample is the same on every run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

mkdirSync(join(out, 'cells'), { recursive: true })

const SCENES = [
  { id: 'base-interior', time: 'lampLit' },
  { id: 'base-exterior', time: 'day' },
] as const

const vertexLight: { scene: string; time: string; at: V3; normal: V3; light: V3 }[] = []
const spriteLight: Record<string, unknown>[] = []
/** The cells' bytes (painted, normals, lit; each w × h × 4), one after another, gzipped into cells.bin.gz. */
const cellBytes: Uint8Array[] = []
let cellOffset = 0
let shadeSource: { r: ReturnType<typeof mapRenderer>; w: number } | null = null

const png = (name: string, rgba: Uint8ClampedArray, w: number, h: number): void => {
  const canvas = createCanvas(w, h)
  canvas.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0)
  writeFileSync(join(out, 'cells', `${name}.png`), canvas.toBuffer('image/png'))
}

for (const scene of SCENES) {
  const map = checkedMap(scene.id)
  if (map.time !== scene.time) throw new Error(`${scene.id} is at ${map.time}, not ${scene.time}`)
  const r = mapRenderer(map, 'diorama') as any
  // The light the scene has at t = 0: every part's per-vertex RGB.
  const strengths = (r.geometry.lamps as any[]).map((l) => strength(l, 0))
  const lit: Float32Array[] = r.vlight.light(strengths)
  const points: { part: number; v: number }[] = []
  r.geometry.parts.forEach((p: any, part: number) => {
    const n = p.mesh.positions.length / 3
    for (let v = 0; v < n; v += 7) points.push({ part, v })
  })
  const rand = seeded(scene.id === 'base-interior' ? 11 : 12)
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[points[i], points[j]] = [points[j] as (typeof points)[0], points[i] as (typeof points)[0]]
  }
  for (const { part, v } of points.slice(0, 200)) {
    const m = r.geometry.parts[part].mesh
    const p = m.positions
    const n = m.normals
    const l = lit[part] as Float32Array
    vertexLight.push({
      scene: scene.id,
      time: scene.time,
      at: [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]] as V3,
      normal: [n[v * 3], n[v * 3 + 1], n[v * 3 + 2]] as V3,
      light: [l[v * 3], l[v * 3 + 1], l[v * 3 + 2]] as V3,
    })
  }

  // The figure cells lit as sprites: the first figure of the scene, captured as the renderer lights it.
  const room = r.drawRoom(0, 1 / 12)
  const original = r.litCell.bind(r)
  let captured = false
  r.litCell = (cell: any, root3: V3, flame: any) => {
    const result = original(cell, root3, flame)
    if (!captured) {
      captured = true
      const { ambient, lights } = r.vlight.spriteLights(root3, flame.strengths, flame.dynamic, flame.colours)
      const lamps = lights.map((l: any) => ({ dir: toCell(l.dir, 0, r.cam.pitch), rgb: l.rgb }))
      const id = `${scene.id}-figure`
      const sector = r.map ? sectorAt(r.map, root3[0], root3[2]) : -1
      const si = sector >= 0 ? LOOK.shade ** (r.map.sectors[sector].shade ?? 0) : 1
      png(`${id}-painted`, cell.rgba, cell.w, cell.h)
      png(`${id}-normals`, cell.normals, cell.w, cell.h)
      png(`${id}-lit`, result.rgba, cell.w, cell.h)
      const bytes = (a: Uint8ClampedArray): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
      cellBytes.push(bytes(cell.rgba), bytes(cell.normals), bytes(result.rgba))
      spriteLight.push({
        cell: id,
        offset: cellOffset,
        w: cell.w,
        h: cell.h,
        ambient,
        lamps,
        step: LOOK.light.step,
        max: LOOK.light.max,
        shade: si,
        style: LOOK.figureLight,
        md5: md5(new Uint8Array(result.rgba.buffer, result.rgba.byteOffset, result.rgba.byteLength)),
        paintedMd5: md5(new Uint8Array(cell.rgba.buffer, cell.rgba.byteOffset, cell.rgba.byteLength)),
        normalsMd5: md5(
          new Uint8Array(cell.normals.buffer, cell.normals.byteOffset, cell.normals.byteLength),
        ),
      })
      cellOffset += cell.w * cell.h * 4 * 3
    }
    return result
  }
  r.drawFigures(room)
  if (!captured) throw new Error(`${scene.id}: no figure was lit`)
  if (scene.id === 'base-interior') shadeSource = { r, w: r.cam.w }
}

// The colour pipeline: a texel's light and haze from the interior's diorama frame, a palette albedo, the one snap.
const shade: { albedo: number; light: V3; share: number; x: number; y: number; out: number }[] = []
{
  const { r, w } = shadeSource as NonNullable<typeof shadeSource>
  const haze = hazeOf(r.time)
  const rand = seeded(21)
  const palette = RAMPS.flat()
  const n = r.cam.w * r.cam.h
  while (shade.length < 500) {
    const k = Math.floor(rand() * n)
    const depth = r.g.depth[k]
    if (!Number.isFinite(depth) || depth < -1e6) continue
    const light: V3 = [r.L.place[k * 3], r.L.place[k * 3 + 1], r.L.place[k * 3 + 2]]
    if (light[0] + light[1] + light[2] <= 0) continue
    const albedo = palette[Math.floor(rand() * palette.length)] as number
    const share = hazeShare(-depth, haze)
    const x = k % w
    const y = Math.floor(k / w)
    const c = hazed(litColour(albedo, light, LOOK.light.gain), light, share, LOOK.haze)
    shade.push({ albedo, light, share, x, y, out: snap(c, x, y, LOOK.dither.strength) })
  }
}

// The tiles: the label arrays of three photo swatches at three texel scales.
const swatches = JSON.parse(readFileSync(at('src/features/world/library/swatches.json'), 'utf8')) as Record<
  string,
  { texture: Record<string, unknown> }
>
const tiles: {
  swatch: string
  texture: unknown
  texels: [number, number]
  w: number
  h: number
  md5: string
}[] = []
for (const name of ['oakFloor', 'brickRed', 'asphalt']) {
  const spec = (swatches[name] as { texture: any }).texture
  for (const texels of [
    [64, 64],
    [64, 22.6],
    [45, 45],
  ] as [number, number][]) {
    const tile = tileOf(spec, texels[0], texels[1])
    tiles.push({
      swatch: name,
      texture: spec,
      texels,
      w: tile.w,
      h: tile.h,
      md5: md5(new Uint8Array(tile.data.buffer, tile.data.byteOffset, tile.data.byteLength)),
    })
  }
}

const write = (name: string, value: unknown): void =>
  writeFileSync(join(out, name), `${JSON.stringify(value, null, 1)}\n`)
write('vertex-light.json', { source: 'EnvironmentBuilder 6d82a52', points: vertexLight })
write('shade.json', {
  source: 'EnvironmentBuilder 6d82a52',
  gain: LOOK.light.gain,
  dither: LOOK.dither.strength,
  haze: LOOK.haze,
  samples: shade,
})
writeFileSync(join(out, 'cells.bin.gz'), gzipSync(Buffer.concat(cellBytes), { level: 9 }))
write('sprite-light.json', { source: 'EnvironmentBuilder 6d82a52', cells: spriteLight })
write('tiles.json', { source: 'EnvironmentBuilder 6d82a52', tiles })
console.log(
  `${vertexLight.length} light points, ${shade.length} shade samples, ${spriteLight.length} sprite cells, ${tiles.length} tiles`,
)
