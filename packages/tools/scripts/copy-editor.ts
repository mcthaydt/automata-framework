// Part of `-tools`' build: puts the editors' page (every editor, the 3D ones too) inside the package, so `automata editor`
// opens it from `dist/editors/suite` with nothing else to install. Before the copy it reads the build for Pixi 3D's
// `./extras` entry, which probes `new Function` at load and so breaks under a strict CSP. Pixi 3D itself is allowed:
// the launch waits for it to go public, so no editor is held back until then, and `pnpm release` refuses to publish
// until it is (`tooling/release/src/check-pixi3d-public.ts`). (The editors' build cannot run this scan:
// `-tools` depends on the editors, not the other way round.)
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPixi3d } from '../src/shared/ship/prepare/pixi3d-markers.ts'

/**
 * Copies `<editorDist>/suite` to `<outDir>/editors/suite`, replacing an earlier copy.
 * Throws, copying nothing, when the build holds Pixi 3D extras or there is no build.
 */
export function copyEditor(editorDist: string, outDir: string): void {
  const source = join(editorDist, 'suite')
  if (!existsSync(join(source, 'index.html')))
    throw new Error('There is no editor build to copy. Build it first: pnpm --filter @automata/editors build')
  const { extras } = findPixi3d(source)
  if (extras[0] !== undefined)
    throw new Error(
      `This build contains Pixi 3D extras (suite/${extras[0].file}), which break under a strict CSP.`,
    )
  const target = join(outDir, 'editors', 'suite')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

// Run as `node scripts/copy-editor.ts` from the package folder (the `build` script does).
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  copyEditor(resolve(here, '../../../extensions/editors/dist'), resolve(here, '../dist'))
}
