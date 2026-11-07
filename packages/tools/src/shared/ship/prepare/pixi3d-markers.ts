// The closed-beta guard. `@pixi/3d` 0.1.0-beta.2 is a closed beta whose terms allow no
// public deployment, and its `./extras` entry probes `new Function` at load, a CSP violation under
// Ruken. A build is read for strings that survive minification (checked against Vite's minified builds of the
// vendored tarball by packages/3d's pixi3d-bundle.test.ts): error and warning ids from @pixi/3d's main
// entry, and for `./extras` the spawn code generator's own source strings (S7 found the name `generateSpawnBurst`
// can be renamed by a minifier; the spike's guard, spikes/s7-pixi3d/src/bundle/extras-guard.ts at 86a5298).
// When Pixi 3D is public, the core markers' check goes (the AF 1.0 launch task); the extras check stays.

import { readFileSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { walk } from './build-files.ts'

/** Strings only @pixi/3d's main entry carries. */
export const PIXI3D_MARKERS: readonly string[] = [
  'View3D.screenToRay:degenerate',
  'View3D.worldToScreen:degenerate',
  'pixi3d-shadow-budget',
]

/** Strings only @pixi/3d's `./extras` carries (its particle spawn code generator). */
export const PIXI3D_EXTRAS_MARKERS: readonly string[] = [
  'generateSpawnBurst',
  'ctx.packedFrames',
  'const packedColor = plan.packedColor;',
]

/** One script that carries a marker. */
export interface Pixi3dFound {
  /** Relative to the build, with forward slashes. */
  readonly file: string
  readonly marker: string
}

// Scripts, and pages, which may carry an inline module script.
const SCRIPT = /\.(?:js|mjs|cjs|html?)$/i

/** Every script in the build that carries @pixi/3d (`core`) or its `./extras` (`extras`), the first marker each. */
export function findPixi3d(distDir: string): { core: Pixi3dFound[]; extras: Pixi3dFound[] } {
  const core: Pixi3dFound[] = []
  const extras: Pixi3dFound[] = []
  for (const path of walk(distDir)) {
    if (!SCRIPT.test(path)) continue
    const file = relative(distDir, path).split(sep).join('/')
    const text = readFileSync(path, 'latin1')
    const coreMarker = PIXI3D_MARKERS.find((marker) => text.includes(marker))
    if (coreMarker !== undefined) core.push({ file, marker: coreMarker })
    const extrasMarker = PIXI3D_EXTRAS_MARKERS.find((marker) => text.includes(marker))
    if (extrasMarker !== undefined) extras.push({ file, marker: extrasMarker })
  }
  return { core, extras }
}
