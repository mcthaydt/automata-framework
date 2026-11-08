import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PIXI3D_EXTRAS_MARKERS, PIXI3D_MARKERS } from '#src/shared/ship/prepare/pixi3d-markers.ts'
import { copyEditor } from '../../../scripts/copy-editor.ts'

// The build of `-tools` copies the editors' one page (every editor, 3D ones too) into `dist/editors/suite`. The page may
// carry Pixi 3D itself, since the launch waits for it to go public; it may not carry the `./extras` entry, which probes
// `new Function` at load and so breaks under a strict CSP.

const made: string[] = []

/** An editor `dist/` with the suite page, and an empty `-tools` `dist/`. */
function folders(files: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'copy-editor-'))
  made.push(root)
  const editorDist = join(root, 'editor-dist')
  const outDir = join(root, 'tools-dist')
  const all = {
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
  // Build audit C1: the Tuner is part of AF with 2D alone, so a stranger's `automata editor` finds it.
  it('copies the suite build to editors/suite, and nothing else', () => {
    const { editorDist, outDir } = folders({ '2d/index.html': 'the old standalone page' })
    copyEditor(editorDist, outDir)
    expect(readFileSync(join(outDir, 'editors/suite/assets/suite.js'), 'utf8')).toBe('console.log("suite")')
    expect(() => readFileSync(join(outDir, 'editors/2d/index.html'))).toThrow()
  })

  it('replaces an earlier copy rather than adding to it', () => {
    const { editorDist, outDir } = folders()
    copyEditor(editorDist, outDir)
    rmSync(join(editorDist, 'suite/assets/suite.js'))
    writeFileSync(join(editorDist, 'suite/assets/other.js'), 'x')
    copyEditor(editorDist, outDir)
    expect(() => readFileSync(join(outDir, 'editors/suite/assets/suite.js'))).toThrow()
    expect(readFileSync(join(outDir, 'editors/suite/assets/other.js'), 'utf8')).toBe('x')
  })

  it('copies a page that holds Pixi 3D: the 3D editors are part of the free editors', () => {
    const { editorDist, outDir } = folders({ 'suite/assets/3d.js': `var a = "${PIXI3D_MARKERS[0]}"` })
    copyEditor(editorDist, outDir)
    expect(readFileSync(join(outDir, 'editors/suite/assets/3d.js'), 'utf8')).toContain(PIXI3D_MARKERS[0])
  })

  it('refuses a page that holds Pixi 3D extras, naming the file, and copies nothing', () => {
    const { editorDist, outDir } = folders({
      'suite/assets/leak.js': `var a = "${PIXI3D_EXTRAS_MARKERS[0]}"`,
    })
    expect(() => copyEditor(editorDist, outDir)).toThrow(
      'This build contains Pixi 3D extras (suite/assets/leak.js), which break under a strict CSP.',
    )
    expect(() => readFileSync(join(outDir, 'editors/suite/index.html'))).toThrow()
  })

  it('says to build the editor first when there is no suite build', () => {
    const { outDir } = folders()
    expect(() => copyEditor(join(outDir, 'missing'), outDir)).toThrow(
      'There is no editor build to copy. Build it first: pnpm --filter @automata/editors build',
    )
  })
})
