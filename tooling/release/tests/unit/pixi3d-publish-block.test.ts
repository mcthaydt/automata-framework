import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pixi3dPublishBlock } from '#src/check-pixi3d-public.ts'
import type { WorkspacePackage } from '#src/publishable-packages.ts'

// The editors' page carries the Pixi 3D closed beta, and `@automata/tools` ships that page. The Owner: "we launch when
// Pixi 3D goes public". So a release is refused while any package still takes `@pixi/3d` from the vendored tarball.

const pkg = (
  name: string,
  extra: { private?: boolean; devDependencies?: Record<string, string> } = {},
): WorkspacePackage => ({
  dir: `packages/${name}`,
  manifest: { name: `@automata/${name}`, version: '0.0.0', ...extra },
})

const VENDORED = { '@pixi/3d': 'file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz' }

describe('pixi3dPublishBlock', () => {
  it('refuses while the tools package is published and a package still reads the vendored beta', () => {
    const block = pixi3dPublishBlock([
      pkg('tools'),
      pkg('editor-3d', { private: true, devDependencies: VENDORED }),
    ])
    expect(block).toContain('@automata/editor-3d')
    expect(block).toMatch(/Pixi 3D/)
  })

  it('lets the release go once @pixi/3d comes from the registry', () => {
    expect(
      pixi3dPublishBlock([
        pkg('tools'),
        pkg('editor-3d', { private: true, devDependencies: { '@pixi/3d': '^0.1.0' } }),
      ]),
    ).toBeUndefined()
  })

  it('has nothing to block when the tools package is not published', () => {
    expect(
      pixi3dPublishBlock([
        pkg('tools', { private: true }),
        pkg('editor-3d', { private: true, devDependencies: VENDORED }),
      ]),
    ).toBeUndefined()
  })
})

describe('the release script', () => {
  it('runs the check before it builds or publishes anything', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    const { scripts } = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(scripts.release?.startsWith('node tooling/release/src/check-pixi3d-public.ts && ')).toBe(true)
  })
})
