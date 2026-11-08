// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanClosedBeta } from '../../../scripts/scan-closed-beta'

const roots: string[] = []

/** A built site with one page and one script; `script` is the script's text. */
function build(script: string): string {
  const root = mkdtempSync(join(tmpdir(), 'site-beta-'))
  roots.push(root)
  mkdirSync(join(root, '_app/immutable/chunks'), { recursive: true })
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Home</title>')
  writeFileSync(join(root, '_app/immutable/chunks/game.js'), script)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('scanClosedBeta', () => {
  it('passes a build without Pixi 3D', () => {
    expect(scanClosedBeta(build('export const game = 1'))).toEqual([])
  })

  // The launch waits for Pixi 3D to go public, so the free editors (Levels 3D, the Studio) carry it until then.
  it('passes a build that carries Pixi 3D itself', () => {
    expect(scanClosedBeta(build('throw new Error("View3D.screenToRay:degenerate")'))).toEqual([])
  })

  it('names the file that carries the extras, which a strict policy breaks', () => {
    expect(scanClosedBeta(build('function generateSpawnBurst(){}'))).toEqual([
      '_app/immutable/chunks/game.js: carries Pixi 3D extras ("generateSpawnBurst"), which break under the site\'s policy',
    ])
  })
})
