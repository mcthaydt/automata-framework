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

  it('names the file that carries the closed beta, and the marker it found', () => {
    expect(scanClosedBeta(build('throw new Error("View3D.screenToRay:degenerate")'))).toEqual([
      '_app/immutable/chunks/game.js: carries the Pixi 3D closed beta ("View3D.screenToRay:degenerate"); it cannot go on a public site',
    ])
  })

  it('catches the extras too', () => {
    expect(scanClosedBeta(build('function generateSpawnBurst(){}'))).toHaveLength(1)
  })
})
