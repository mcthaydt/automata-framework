// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { arrangeScenes } from '../../../scripts/scenes.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function put(root: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
}

/** What the runner's build writes for two scene examples and a 3D example of another module, and the examples folder. */
function runnerOutput() {
  const base = mkdtempSync(join(tmpdir(), 'scenes-'))
  roots.push(base)
  const out = join(base, 'out')
  const examples = join(base, 'examples')
  put(out, {
    'index.html': '<a href="./scene/lamp/">',
    'scene/lamp/index.html': '<script type="module" src="../../assets/lamp-aaa.js"></script>',
    'scene/lamp/source/index.html': '<pre>source</pre>',
    'scene/panel/index.html': '<script type="module" src="../../assets/panel-bbb.js"></script>',
    'render3d/render3d-meshes/index.html': '<script src="../../assets/meshes-ccc.js"></script>',
    'assets/lamp-aaa.js': 'import "./shared-ddd.js"; fetch(new URL("lamp-tex-eee.png", import.meta.url))',
    'assets/shared-ddd.js': 'export const shared = 1',
    'assets/lamp-tex-eee.png': 'png',
    'assets/panel-bbb.js': 'import "./shared-ddd.js"; export const panel = 1',
    'assets/meshes-ccc.js': 'export const meshes = 1',
  })
  put(examples, { 'scene/scene-lamp.png': 'still' })
  return { out, examples }
}

describe('arrangeScenes', () => {
  it('keeps the pages of the examples the site shows, and what they load, and nothing of any other example', () => {
    const { out, examples } = runnerOutput()
    arrangeScenes(out, examples, [{ id: 'scene-lamp', module: 'scene', name: 'lamp' }])
    const files = readdirSync(out, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(out.length + 1))
      .sort()
    expect(files).toEqual([
      'assets/lamp-aaa.js',
      'assets/lamp-tex-eee.png',
      'assets/shared-ddd.js',
      'scene/lamp/index.html',
      'scene/lamp/source/index.html',
    ])
  })

  it('copies an approved still to stills/<id>.png and writes none for an example without one', () => {
    const { out, examples } = runnerOutput()
    arrangeScenes(out, examples, [
      { id: 'scene-lamp', module: 'scene', name: 'lamp', still: '/scenes/stills/scene-lamp.png' },
    ])
    expect(existsSync(join(out, 'stills/scene-lamp.png'))).toBe(true)
    const none = runnerOutput()
    arrangeScenes(none.out, none.examples, [{ id: 'scene-lamp', module: 'scene', name: 'lamp' }])
    expect(existsSync(join(none.out, 'stills'))).toBe(false)
  })
})
