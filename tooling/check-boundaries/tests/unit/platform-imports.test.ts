import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPlatformSources, platformImportFindings } from '#src/platform-imports.ts'

// DIST spec §5.1 (DIST-b): a platform's packages are imported only from files under a folder named for its target,
// tests included; strings and comments that merely name a package are not imports.

describe('platformImportFindings', () => {
  it.each([
    ["import { Ruken } from '@ruken/sdk'", '@ruken/sdk', '@mcthaydt/automata-host'],
    ["import type { Capability } from '@ruken/sdk'", '@ruken/sdk', '@mcthaydt/automata-host'],
    ["export { createFakeHost } from '@ruken/sdk-host/testing'", '@ruken/sdk-host/testing', 'FakeHosting'],
    ["export * from '@ruken/manifest'", '@ruken/manifest', '@mcthaydt/automata-content/game-config'],
    ["await import('@ruken/cli')", '@ruken/cli', 'automata-ship'],
    ["import '@tauri-apps/api/core'", '@tauri-apps/api/core', "'tauri'"],
  ])(
    'finds `%s` outside its target folder, naming the import and the replacement',
    (code, specifier, hint) => {
      const [finding] = platformImportFindings('packages/ui/src/a.ts', `${code}\n`)
      expect(finding).toMatchObject({ file: 'packages/ui/src/a.ts', line: 1, rule: 'platform-import' })
      expect(finding?.message).toContain(`"${specifier}"`)
      expect(finding?.message).toContain(hint)
    },
  )

  it('allows each platform under its own folder only', () => {
    expect(platformImportFindings('packages/host/src/ruken/a.ts', "import '@ruken/sdk'\n")).toEqual([])
    expect(platformImportFindings('packages/host/src/tauri/a.ts', "import '@tauri-apps/api'\n")).toEqual([])
    expect(platformImportFindings('packages/host/src/tauri/a.ts', "import '@ruken/sdk'\n")).toHaveLength(1)
    expect(platformImportFindings('packages/rukenish/src/a.ts', "import '@ruken/sdk'\n")).toHaveLength(1)
  })

  it('ignores a package named in a string, a comment or a template', () => {
    const code = [
      "// import { Ruken } from '@ruken/sdk'",
      "const dependency = '@ruken/sdk'",
      "const fixture = `import { x } from '@ruken/manifest'`",
      "import { z } from 'zod'",
    ].join('\n')
    expect(platformImportFindings('tooling/release/src/a.test.ts', code)).toEqual([])
  })

  it("checks a Svelte component's scripts, at their lines in the file", () => {
    const code = [
      '<p>hi</p>',
      '<script lang="ts">',
      "  import type { Capability } from '@ruken/sdk'",
      '</script>',
    ].join('\n')
    expect(platformImportFindings('packages/ui/src/A.svelte', code)).toMatchObject([{ line: 3 }])
  })
})

describe('collectPlatformSources', () => {
  it('takes tests and Svelte files too, and skips node_modules, dist and declarations', () => {
    const root = mkdtempSync(join(tmpdir(), 'af-platform-'))
    try {
      for (const file of [
        'src/a.ts',
        'src/a.test.ts',
        'src/A.svelte',
        'src/b.d.ts',
        'node_modules/x/i.ts',
        'dist/i.js',
      ]) {
        mkdirSync(join(root, dirname(file)), { recursive: true })
        writeFileSync(join(root, file), '')
      }
      expect(collectPlatformSources(root).map((file) => file.slice(root.length + 1))).toEqual([
        'src/A.svelte',
        'src/a.test.ts',
        'src/a.ts',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('the --platform-imports run', () => {
  const cli = join(import.meta.dirname, '../../src/cli.ts')

  it('exits 1 with each finding, and 0 on a clean tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'af-platform-cli-'))
    try {
      mkdirSync(join(root, 'src/ruken'), { recursive: true })
      writeFileSync(join(root, 'src/ruken/ok.ts'), "import '@ruken/sdk'\n")
      const clean = spawnSync(process.execPath, [cli, '--platform-imports', 'src'], {
        cwd: root,
        encoding: 'utf8',
      })
      expect(clean.status).toBe(0)
      writeFileSync(join(root, 'src/bad.ts'), "import '@ruken/sdk'\n")
      const dirty = spawnSync(process.execPath, [cli, '--platform-imports', 'src'], {
        cwd: root,
        encoding: 'utf8',
      })
      expect(dirty.status).toBe(1)
      expect(dirty.stdout).toContain('src/bad.ts:1:1  platform-import')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
