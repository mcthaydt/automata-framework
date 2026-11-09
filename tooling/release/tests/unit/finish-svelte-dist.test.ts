import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { finishSvelteDist } from '#src/finish-svelte-dist.ts'

function distWith(files: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'af-svelte-dist-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true })
    writeFileSync(join(dist, path), text)
  }
  return dist
}

describe('finishSvelteDist', () => {
  it('removes tests, test setup and test fixtures (components and modules), keeping the package files', () => {
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
      'testing/locale-fixture.js': '',
      'testing/locale-fixture.d.ts': '',
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
      'testing/locale-fixture.js',
      'testing/locale-fixture.d.ts',
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
    finishSvelteDist(dist, {
      vendoredTypes: { '@ruken/sdk': 'vendor/ruken-sdk.js' },
    })
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

  // DX.2a: svelte-package keeps a `.ts` specifier in declarations (game imports `./define-game.ts`, with
  // rewriteRelativeImportExtensions rewriting only the JavaScript), which no consumer can resolve.
  it('turns a relative .ts specifier in a declaration into the .js file it was emitted as', () => {
    const dist = distWith({
      'index.d.ts': "export { defineGame } from './define-game.ts';\nexport type { X } from './types.ts';\n",
      'screens/PausedScreen.svelte.d.ts': "import type { PausedSaves } from './saves-paused.ts';\n",
      'define-game.js': '',
      'define-game.d.ts': '',
      'types.d.ts': '',
      'screens/saves-paused.js': '',
      'screens/saves-paused.d.ts': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {} })
    const dts = readFileSync(join(dist, 'index.d.ts'), 'utf8')
    expect(dts).toContain("from './define-game.js'")
    expect(dts).toContain("from './types.js'")
    expect(readFileSync(join(dist, 'screens/PausedScreen.svelte.d.ts'), 'utf8')).toContain(
      "from './saves-paused.js'",
    )
  })

  // svelte-package leaves `.svelte` files as source, so a component's value import of a `.svelte.ts` module still
  // names a file that is not in dist; a game's build then cannot resolve it.
  it('turns a relative .ts specifier in a .svelte source into the .js file it was emitted as', () => {
    const dist = distWith({
      'app/screens/PlayScreen.svelte':
        '<script lang="ts">\nimport { providePlay } from "../../shared/ui/slots/play-context.svelte.ts";\n</script>\n',
      'shared/ui/slots/play-context.svelte.js': '',
      'shared/ui/slots/play-context.svelte.d.ts': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {} })
    expect(readFileSync(join(dist, 'app/screens/PlayScreen.svelte'), 'utf8')).toContain(
      'from "../../shared/ui/slots/play-context.svelte.js"',
    )
  })

  // DX.2a: game imports the value `SLUG_RE` from `@ruken/manifest`, so its JavaScript names the vendored package
  // too; tsdown bundles it into `dist/vendor/ruken-manifest.js` (D-8).
  it('points JavaScript and declarations at vendored code bundled into dist', () => {
    const dist = distWith({
      'define-game.js': "import { SLUG_RE } from '@ruken/manifest';\n",
      'screens/kit.d.ts': 'import type { Manifest } from "@ruken/manifest";\n',
      'other.js': "import { x } from '@ruken/manifest-extra';\n",
      'vendor/ruken-manifest.js': '',
      'vendor/ruken-manifest.d.ts': '',
    })
    finishSvelteDist(dist, {
      vendoredTypes: {},
      vendoredCode: { '@ruken/manifest': 'vendor/ruken-manifest.js' },
    })
    expect(readFileSync(join(dist, 'define-game.js'), 'utf8')).toContain("from './vendor/ruken-manifest.js'")
    expect(readFileSync(join(dist, 'screens/kit.d.ts'), 'utf8')).toContain(
      'from "../vendor/ruken-manifest.js"',
    )
    expect(readFileSync(join(dist, 'other.js'), 'utf8')).toContain("from '@ruken/manifest-extra'")
  })

  // DX.2a: a package's test helpers outside a `.test.` file (game's `input/testing/`) are not part of it.
  it('removes the test-only folders a package names', () => {
    const dist = distWith({
      'index.js': '',
      'input/keys.js': '',
      'input/testing/device-run.js': '',
      'input/testing/device-run.d.ts': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {}, testOnly: ['input/testing'] })
    expect(existsSync(join(dist, 'input/keys.js'))).toBe(true)
    expect(existsSync(join(dist, 'input/testing'))).toBe(false)
  })

  // DX.2a: svelte-package keeps game's `import './screens.css'` in its declarations, and TypeScript 6 and 7
  // (noUncheckedSideEffectImports) fail a game's typecheck on a stylesheet they cannot resolve as a module.
  it('drops stylesheet imports from declarations, keeping them in the JavaScript', () => {
    const dist = distWith({
      'screens/default-screens.d.ts': [
        "import '@automata/ui/theme.css';",
        'import "./screens.css";',
        "import { type ScreenDef } from '@automata/runtime';",
        'export declare const x: ScreenDef;',
      ].join('\n'),
      'screens/default-screens.js': "import '@automata/ui/theme.css';\nimport './screens.css';\n",
      'screens/screens.css': '',
    })
    finishSvelteDist(dist, { vendoredTypes: {} })
    const dts = readFileSync(join(dist, 'screens/default-screens.d.ts'), 'utf8')
    expect(dts).not.toContain('.css')
    expect(dts).toContain("import { type ScreenDef } from '@automata/runtime';")
    expect(readFileSync(join(dist, 'screens/default-screens.js'), 'utf8')).toBe(
      "import '@automata/ui/theme.css';\nimport './screens.css';\n",
    )
  })
})
