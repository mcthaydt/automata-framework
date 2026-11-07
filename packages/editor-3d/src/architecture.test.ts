import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkArchitecture, type Violation } from './testing/architecture'

// The boundary between the headless editor and its Svelte views (ED3D-D1; plan ED3D.5c step 6), as a test over the
// import graph. `purity.test.ts` keeps the headless layers free of the DOM, the clock and Svelte; this test keeps the
// components in `ui/` and makes `ui/` reach the editor only through `app/`. The rules run on a map of path to source,
// so they are tested on planted trees first and then on the real one.

const rules = (violations: readonly Violation[]): string[] => violations.map((violation) => violation.rule)
const tree = (files: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(files))
const component = (script: string, markup = '<p>x</p>'): string =>
  `<script lang="ts">\n${script}\n</script>\n${markup}`

describe('checkArchitecture: components', () => {
  it('lets a component live in ui/ and nowhere else', () => {
    expect(checkArchitecture(tree({ 'ui/Home.svelte': component('') }))).toEqual([])
    for (const path of ['app/Home.svelte', 'model/Field.svelte', 'Root.svelte']) {
      expect(rules(checkArchitecture(tree({ [path]: component('') }))), path).toEqual(['components-in-ui'])
    }
  })
})

describe('checkArchitecture: the headless layers', () => {
  it('may import the kit core, zod and each other', () => {
    const files = tree({
      'app/a.ts': "import { readStored } from '@automata/editor/kit/core'\nimport { b } from '../model/b'",
      'model/b.ts': "import { z } from 'zod'\nexport const b = z.string()",
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('import no view: nothing in ui/, no component, no Svelte, not the kit root nor the geometry owner', () => {
    for (const specifier of [
      '../ui/boot',
      './Panel.svelte',
      'svelte',
      'svelte/store',
      '@automata/editor/kit',
      '@automata/editor/suite',
      '@automata/ui',
    ]) {
      const files = tree({ 'app/a.ts': `import x from '${specifier}'\nexport default x` })
      expect(rules(checkArchitecture(files)), specifier).toEqual(['headless-imports-view'])
    }
  })

  it('sees a re-export and a type import too', () => {
    const files = tree({
      'app/a.ts': "export { default } from '../ui/App.svelte'",
      'app/b.ts': "import type { X } from '../ui/types'",
    })
    expect(rules(checkArchitecture(files))).toEqual(['headless-imports-view', 'headless-imports-view'])
  })

  it('lets main.ts, the page entry, import the views', () => {
    expect(checkArchitecture(tree({ 'main.ts': "import { startEditor } from './ui/boot'" }))).toEqual([])
  })
})

describe('checkArchitecture: ui/', () => {
  it('reaches the editor through app/, and may name the types of any layer', () => {
    const files = tree({
      'ui/boot.ts': "import { mount } from 'svelte'\nimport { createEditorApp } from '../app/editor-app'",
      'ui/Panel.svelte': component(
        "import type { ParseIssue } from '../profile/file-codec'\nimport { errorPanel } from '../app/document/open-flow-model'\nimport Row from './Row.svelte'",
      ),
    })
    expect(checkArchitecture(files)).toEqual([])
  })

  it('never imports another layer for its code', () => {
    for (const specifier of [
      '../../model/level-editor',
      '../../codec/patch',
      '../../../src/profile/registry',
    ]) {
      const files = tree({ 'ui/document/Panel.svelte': component(`import { x } from '${specifier}'`) })
      expect(rules(checkArchitecture(files)), specifier).toEqual(['ui-through-app'])
    }
  })

  it('reads no clock, timer or randomness of its own: time comes in through the boot', () => {
    for (const code of [
      'const t = Date.now()',
      'setTimeout(f, 1)',
      'const r = Math.random()',
      'performance.now()',
    ]) {
      expect(rules(checkArchitecture(tree({ 'ui/boot.ts': code }))), code).toEqual(['ui-clock'])
      expect(rules(checkArchitecture(tree({ 'ui/A.svelte': component(code) }))), code).toEqual(['ui-clock'])
    }
  })

  it('does not count a word in a comment or a sentence', () => {
    const files = tree({
      'ui/A.svelte': component("// no Date.now() here\nconst label = 'setTimeout is not used'"),
    })
    expect(checkArchitecture(files)).toEqual([])
  })
})

describe('the real tree', () => {
  function sources(dir: string, prefix = ''): [string, string][] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, string][] => {
      const path = `${prefix}${entry.name}`
      if (entry.isDirectory())
        return entry.name === 'testing' ? [] : sources(join(dir, entry.name), `${path}/`)
      if (!/\.(ts|svelte)$/.test(entry.name) || entry.name.endsWith('.test.ts')) return []
      return [[path, readFileSync(join(dir, entry.name), 'utf8')]]
    })
  }

  it('obeys every rule', () => {
    const files = new Map(sources(new URL('.', import.meta.url).pathname))
    expect(files.size).toBeGreaterThan(100)
    expect(checkArchitecture(files)).toEqual([])
  })
})
