import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PIXI3D_EXTRAS_MARKERS, PIXI3D_MARKERS } from '#src/shared/ship/prepare/pixi3d-markers.ts'
import { copyEditor } from '../../../scripts/copy-editor.ts'

// The build of `-tools` copies the editor's 2D build into `dist/editors/2d`, after the closed-beta scan has read the
// 2D build and the suite build: the published package must never carry the private Pixi 3D beta.

const made: string[] = []

/** An editor `dist/` with a 2D build and a suite build, and an empty `-tools` `dist/`. */
function folders(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'copy-editor-'))
  made.push(root)
  const editorDist = join(root, 'editor-dist')
  const outDir = join(root, 'tools-dist')
  const all = {
    '2d/index.html': '<!doctype html><script src="./assets/app.js"></script>',
    '2d/assets/app.js': 'console.log("2d")',
    'suite/index.html': '<!doctype html>',
    'suite/assets/suite.js': 'console.log("suite")',
    ...files,
  }
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(editorDist, path, '..'), { recursive: true })
    writeFileSync(join(editorDist, path), text)
  }
  mkdirSync(outDir)
  return { editorDist, outDir }
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('copyEditor', () => {
  it('copies the 2D build to editors/2d, and not the suite', () => {
    const { editorDist, outDir } = folders()
    copyEditor(editorDist, outDir)
    expect(readFileSync(join(outDir, 'editors/2d/assets/app.js'), 'utf8')).toBe('console.log("2d")')
    expect(() => readFileSync(join(outDir, 'editors/suite/index.html'))).toThrow()
  })

  it('replaces an earlier copy rather than adding to it', () => {
    const { editorDist, outDir } = folders()
    copyEditor(editorDist, outDir)
    rmSync(join(editorDist, '2d/assets/app.js'))
    writeFileSync(join(editorDist, '2d/assets/other.js'), 'x')
    copyEditor(editorDist, outDir)
    expect(() => readFileSync(join(outDir, 'editors/2d/assets/app.js'))).toThrow()
    expect(readFileSync(join(outDir, 'editors/2d/assets/other.js'), 'utf8')).toBe('x')
  })

  it.each([
    ['2d', PIXI3D_MARKERS[0]],
    ['suite', PIXI3D_MARKERS[0]],
    ['2d', PIXI3D_EXTRAS_MARKERS[0]],
  ] as const)(
    'refuses a %s build that holds the private Pixi 3D beta, naming the file, and copies nothing',
    (build, marker) => {
      const { editorDist, outDir } = folders({ [`${build}/assets/leak.js`]: `var a = "${marker}"` })
      expect(() => copyEditor(editorDist, outDir)).toThrow(
        `This build contains the private Pixi 3D beta (${build}/assets/leak.js). It cannot be published.`,
      )
      expect(() => readFileSync(join(outDir, 'editors/2d/index.html'))).toThrow()
    },
  )

  it('says to build the editor first when there is no 2D build', () => {
    const { outDir } = folders()
    expect(() => copyEditor(join(outDir, 'missing'), outDir)).toThrow(
      'There is no 2D editor build to copy. Build it first: pnpm --filter @automata/editor build',
    )
  })
})
