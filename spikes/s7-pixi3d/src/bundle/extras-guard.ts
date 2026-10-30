// S7-g's bundle guard, written to move into packages/render-pixi3d (M3.4a) as it is: a built game must not contain
// @pixi/3d's `./extras` particle code, whose module probes `new Function` at load (generateSpawnBurst.mjs calls
// pixi's `unsafeEvalSupported()`), a CSP violation under Ruken.
//
// The name `generateSpawnBurst` survives only in an unminified build: a minified bundle renames it (S7 found the
// spike's production build has no `generateSpawnBurst` at all while the extras code is in it). So the guard also
// looks for string literals the spawn code generator emits (extras/particles/utils/generateSpawn.mjs), which a
// minifier keeps.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const EXTRAS_MARKERS: readonly string[] = [
  'generateSpawnBurst',
  'ctx.packedFrames',
  'const packedColor = plan.packedColor;',
]

export interface ExtrasHit {
  readonly file: string
  readonly marker: string
}

function scriptsUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((name) => join(dir, name))
    .filter((path) => /\.m?js$/.test(path) && statSync(path).isFile())
}

/** Every built script under `dir` that carries an extras marker. */
export function findExtras(dir: string): ExtrasHit[] {
  const hits: ExtrasHit[] = []
  for (const file of scriptsUnder(dir)) {
    const text = readFileSync(file, 'utf8')
    const marker = EXTRAS_MARKERS.find((m) => text.includes(m))
    if (marker) hits.push({ file, marker })
  }
  return hits
}

/** Throws when the build under `dir` contains @pixi/3d's extras. */
export function assertNoExtras(dir: string): void {
  const hits = findExtras(dir)
  if (hits.length > 0) {
    const list = hits.map((hit) => `${hit.file} (${hit.marker})`).join(', ')
    throw new Error(`@pixi/3d/extras is in the bundle (it probes new Function under the CSP): ${list}`)
  }
}
