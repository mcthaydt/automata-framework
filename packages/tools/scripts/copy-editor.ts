// Part of `-tools`' build: puts the 2D editor inside the package, so `automata editor` opens it from `dist/editors/2d`
// with nothing else to install. Before the copy it reads the editor's 2D build and its suite build for the private
// Pixi 3D beta, the one scan `ship prepare` runs (the editor's own build cannot run it: `-tools` depends on the editor,
// not the other way round).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPixi3d } from '../src/shared/ship/prepare/pixi3d-markers.ts'

/** The editor builds a leak would come from. Only the 2D one is copied. */
const SCANNED = ['2d', 'suite'] as const

/**
 * Copies `<editorDist>/2d` to `<outDir>/editors/2d`, replacing an earlier copy. Throws, copying nothing, when a build
 * holds the Pixi 3D beta or there is no 2D build.
 */
export function copyEditor(editorDist: string, outDir: string): void {
  const source = join(editorDist, '2d')
  if (!existsSync(join(source, 'index.html')))
    throw new Error(
      'There is no 2D editor build to copy. Build it first: pnpm --filter @automataframework/automata-editor build',
    )
  for (const build of SCANNED) {
    const folder = join(editorDist, build)
    if (!existsSync(folder)) continue
    const { core, extras } = findPixi3d(folder)
    const found = core[0] ?? extras[0]
    if (found !== undefined)
      throw new Error(
        `This build contains the private Pixi 3D beta (${build}/${found.file}). It cannot be published.`,
      )
  }
  const target = join(outDir, 'editors/2d')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

// Run as `node scripts/copy-editor.ts` from the package folder (the `build` script does).
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  copyEditor(resolve(here, '../../editor/dist'), resolve(here, '../dist'))
}
