// Part of `-tools`' build: puts the 2D editor and the suite's 2D page (the level editor beside the Tuner) inside the
// package, so `automata editor` and `automata editor --app suite` open them from `dist/editors/2d` and
// `dist/editors/suite` with nothing else to install. Before the copy it reads both builds for the private Pixi 3D beta,
// the one scan `ship prepare` runs (the editor's own build cannot run it: `-tools` depends on the editor, not the
// other way round). The 3D editors are not copied: they wait for the 3D slice.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPixi3d } from '../src/shared/ship/prepare/pixi3d-markers.ts'

/** The editor builds that ship in `-tools`; each is scanned, then copied. */
const SHIPPED = ['2d', 'suite'] as const

/**
 * Copies `<editorDist>/2d` and `<editorDist>/suite` (when built) to `<outDir>/editors/`, replacing an earlier copy.
 * Throws, copying nothing, when a build holds the Pixi 3D beta or there is no 2D build.
 */
export function copyEditor(editorDist: string, outDir: string): void {
  const source = join(editorDist, '2d')
  if (!existsSync(join(source, 'index.html')))
    throw new Error(
      'There is no 2D editor build to copy. Build it first: pnpm --filter @automata/editor build',
    )
  for (const build of SHIPPED) {
    const folder = join(editorDist, build)
    if (!existsSync(folder)) continue
    const { core, extras } = findPixi3d(folder)
    const found = core[0] ?? extras[0]
    if (found !== undefined)
      throw new Error(
        `This build contains the private Pixi 3D beta (${build}/${found.file}). It cannot be published.`,
      )
  }
  for (const build of SHIPPED) {
    const from = join(editorDist, build)
    if (!existsSync(from)) continue
    const target = join(outDir, 'editors', build)
    rmSync(target, { recursive: true, force: true })
    mkdirSync(dirname(target), { recursive: true })
    cpSync(from, target, { recursive: true })
  }
}

// Run as `node scripts/copy-editor.ts` from the package folder (the `build` script does).
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  copyEditor(resolve(here, '../../editor/dist'), resolve(here, '../dist'))
}
