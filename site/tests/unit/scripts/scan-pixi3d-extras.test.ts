// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanPixi3dExtras } from '../../../scripts/scan-pixi3d-extras'

const roots: string[] = []

/** A built site with one page and one script; `script` is the script's text. */
function build(script: string): string {
  const root = mkdtempSync(join(tmpdir(), 'site-pixi3d-'))
  roots.push(root)
  mkdirSync(join(root, '_app/immutable/chunks'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Home</title>')
  writeFileSync(join(root, '_app/immutable/chunks/game.js'), script)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

// Pixi 3D is public (npmjs.org, MIT), so a page may carry it. Its `./extras` probes `new Function` at load, which the
// site's no-eval CSP refuses, so no page may carry that.
describe('scanPixi3dExtras', () => {
  it('passes a build without Pixi 3D', () => {
    expect(scanPixi3dExtras(build('export const game = 1'))).toEqual([])
  })

  it('passes a build that carries Pixi 3D', () => {
    expect(scanPixi3dExtras(build('throw new Error("View3D.screenToRay:degenerate")'))).toEqual([])
  })

  it('names the file that carries the extras, and the marker it found', () => {
    expect(scanPixi3dExtras(build('function generateSpawnBurst(){}'))).toEqual([
      '_app/immutable/chunks/game.js: carries Pixi 3D\'s extras ("generateSpawnBurst"), which need eval; the site\'s CSP refuses it',
    ])
  })
})
