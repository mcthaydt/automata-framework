import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { finishSvelteDist } from './finish-svelte-dist.ts'

function distWith(files: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'af-svelte-dist-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true })
    writeFileSync(join(dist, path), text)
  }
  return dist
}

describe('finishSvelteDist', () => {
  it('removes tests, test setup and test fixtures, keeping the package files', () => {
    const dist = distWith({
      'index.js': '',
      'index.d.ts': '',
      'index.test.js': '',
      'index.test.d.ts': '',
      'vitest-setup.js': '',
      'dialog/Dialog.svelte': '',
      'dialog/Dialog.svelte.d.ts': '',
      'dialog/DialogHarness.test.svelte': '',
      'dialog/dialog.layout.test.js': '',
      'testing/index.js': '',
      'testing/StatusFixture.svelte': '',
      'testing/StatusFixture.svelte.d.ts': '',
      'theme.css': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {} })
    for (const kept of ['index.js', 'index.d.ts', 'dialog/Dialog.svelte', 'testing/index.js', 'theme.css']) {
      expect(existsSync(join(dist, kept)), kept).toBe(true)
    }
    for (const gone of [
      'index.test.js',
      'index.test.d.ts',
      'vitest-setup.js',
      'dialog/DialogHarness.test.svelte',
      'dialog/dialog.layout.test.js',
      'testing/StatusFixture.svelte',
      'testing/StatusFixture.svelte.d.ts',
    ]) {
      expect(existsSync(join(dist, gone)), gone).toBe(false)
    }
  })

  it('points declarations that import a vendored package at its inlined types, at any depth', () => {
    const dist = distWith({
      'status/boot-failure.d.ts':
        "import type { RukenError } from '@ruken/sdk';\nexport type X = RukenError\n",
      'index.d.ts': 'import type { A } from "@ruken/sdk";\n',
      'other.d.ts': "import type { B } from '@ruken/sdk-host';\n",
    })
    finishSvelteDist(dist, { vendoredTypes: { '@ruken/sdk': 'vendor/ruken-sdk.js' } })
    expect(readFileSync(join(dist, 'status/boot-failure.d.ts'), 'utf8')).toContain(
      "from '../vendor/ruken-sdk.js'",
    )
    expect(readFileSync(join(dist, 'index.d.ts'), 'utf8')).toContain('from "./vendor/ruken-sdk.js"')
    // A different package with the same prefix is left alone (and the release list test then fails on it).
    expect(readFileSync(join(dist, 'other.d.ts'), 'utf8')).toContain("from '@ruken/sdk-host'")
  })

  it('gives relative imports a .js extension, so the package loads in Node and under nodenext types', () => {
    const dist = distWith({
      'index.js': [
        "export { a } from './browser/device-class';",
        "export { Tracker } from './browser/input-method.svelte';",
        "export { default as Dialog } from './dialog/Dialog.svelte';",
        "export * from './layout';",
        "import './theme.css';",
        "export { b } from './done.js';",
        "export { c } from 'svelte';",
        "const lazy = () => import('./browser/device-class');",
      ].join('\n'),
      'index.d.ts': "export { a } from './browser/device-class';\nexport type { T } from './types';\n",
      'browser/device-class.js': '',
      'browser/device-class.d.ts': '',
      'browser/input-method.svelte.js': '',
      'dialog/Dialog.svelte': '',
      'layout/index.js': '',
      'types.d.ts': '',
      'done.js': '',
      'theme.css': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {} })
    const js = readFileSync(join(dist, 'index.js'), 'utf8')
    expect(js).toContain("from './browser/device-class.js'")
    expect(js).toContain("from './browser/input-method.svelte.js'")
    expect(js).toContain("from './dialog/Dialog.svelte'")
    expect(js).toContain("from './layout/index.js'")
    expect(js).toContain("import './theme.css'")
    expect(js).toContain("from './done.js'")
    expect(js).toContain("from 'svelte'")
    expect(js).toContain("import('./browser/device-class.js')")
    const dts = readFileSync(join(dist, 'index.d.ts'), 'utf8')
    expect(dts).toContain("from './browser/device-class.js'")
    expect(dts).toContain("from './types.js'")
  })
})
