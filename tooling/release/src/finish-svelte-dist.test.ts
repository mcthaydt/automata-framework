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
})
