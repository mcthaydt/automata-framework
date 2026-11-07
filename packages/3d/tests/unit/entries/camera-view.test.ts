// The pure `./camera-view` entry (M3 spec §4.2, amended 2026-10-30): the view's schema, the lens and the heading
// maths for the renderer and the 3D level editor, with no Pixi and no `@pixi/3d` anywhere in its module graph.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as entry from '#src/entries/camera-view.ts'
import * as sim from '#src/entries/sim.ts'

/** Every bare import reachable from `file` through relative imports. */
function bareImports(file: string, seen = new Set<string>()): Set<string> {
  const found = new Set<string>()
  if (seen.has(file)) return found
  seen.add(file)
  const source = readFileSync(file, 'utf8')
  for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
    if (spec === undefined) continue
    if (spec.startsWith('.')) {
      for (const inner of bareImports(resolve(dirname(file), spec.replace(/\.js$/, '.ts')), seen))
        found.add(inner)
    } else found.add(spec)
  }
  return found
}

describe('./camera-view', () => {
  it('is the 24 mm lens: 53.13° vertical, 2·atan(12 / mm) (The Last Light’s convention)', () => {
    expect(entry.LENS_MM).toBe(24)
    expect(entry.fovOf(24)).toBeCloseTo(53.1301, 4)
    expect(entry.fovOf(50)).toBeCloseTo(27.0, 1)
    // At 24 mm the visible height at distance d is exactly d.
    expect(2 * Math.tan((entry.fovOf(24) * Math.PI) / 360)).toBeCloseTo(1, 12)
  })

  it('re-exports the sim’s one definition of the view and the heading, not a copy', () => {
    expect(entry.cameraViewSchema).toBe(sim.cameraViewSchema)
    expect(entry.cameraView).toBe(sim.cameraView)
    expect(entry.CAMERA_DEFAULTS).toBe(sim.CAMERA_DEFAULTS)
    expect(entry.CAMERA_RANGES).toBe(sim.CAMERA_RANGES)
    expect(entry.wrapHeading).toBe(sim.wrapHeading)
    expect(entry.turnHeading).toBe(sim.turnHeading)
    expect(entry.degToHeading).toBe(sim.degToHeading)
    expect(entry.headingDegrees).toBe(sim.headingDegrees)
    expect(entry.TURN_UNITS).toBe(65_536)
    expect(entry.MAX_CAMERA_TURN).toBe(8_192)
  })

  it('imports nothing but zod: no pixi.js, no @pixi/3d', () => {
    const imports = [
      ...bareImports(resolve(import.meta.dirname, '../../../src/entries/camera-view.ts')),
    ].sort()
    expect(imports).toEqual(['zod'])
  })
})
