// Part of `-tools`' build: puts the suite's 2D page (the level editor beside the Tuner) inside the package, so
// `automata editor` opens it from `dist/editors/suite` with nothing else to install. Before the copy it reads the build
// for the private Pixi 3D beta, the one scan `ship prepare` runs (the editor's own build cannot run it: `-tools` depends
// on the editor, not the other way round). The full page, with the 3D editors, is not copied: it waits for the 3D slice.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findPixi3d } from '../src/shared/ship/prepare/pixi3d-markers.ts'

/**
 * Copies `<editorDist>/suite` to `<outDir>/editors/suite`, replacing an earlier copy.
 * Throws, copying nothing, when the build holds the Pixi 3D beta or there is no build.
 */
export function copyEditor(editorDist: string, outDir: string): void {
  const source = join(editorDist, 'suite')
  if (!existsSync(join(source, 'index.html')))
    throw new Error('There is no editor build to copy. Build it first: pnpm --filter @automata/editor build')
  const { core, extras } = findPixi3d(source)
  const found = core[0] ?? extras[0]
  if (found !== undefined)
    throw new Error(
      `This build contains the private Pixi 3D beta (suite/${found.file}). It cannot be published.`,
    )
  const target = join(outDir, 'editors', 'suite')
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true })
}

// Run as `node scripts/copy-editor.ts` from the package folder (the `build` script does).
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  copyEditor(resolve(here, '../../editor/dist'), resolve(here, '../dist'))
}
