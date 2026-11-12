// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  isPlaygroundImport,
  PLAYGROUND_IMPORT_LIST,
  playgroundImportMap,
} from '../../../../playground/src/playground-imports.ts'

const RUNTIME = {
  automata: '/playground/runtime/automata-LRkvFZ12.js',
  zod: '/playground/runtime/zod-CSYgToI_.js',
  uiScreens: '/playground/runtime/ui-screens-Qw3rTy7u.js',
  noEval: '/playground/runtime/no-eval-Q1w2e3R4.js',
  frame: '/playground/runtime/frame-DCEneEhm.js',
  styles: [],
}

// What `@automata/ui-screens` publishes as code, read from its package: a screen added there with no line in the
// playground's import map would compile in an example and then fail to load in the frame.
const publishedScreens = (): string[] => {
  const pkg = JSON.parse(
    readFileSync(new URL('../../../../../extensions/ui-screens/package.json', import.meta.url), 'utf8'),
  ) as { exports: Record<string, unknown> }
  return Object.keys(pkg.exports)
    .filter((subpath) => !subpath.includes('*'))
    .map((subpath) => `@automata/ui-screens${subpath.slice(1)}`)
}

describe('the playground imports', () => {
  it('serve the framework, Zod and every screen @automata/ui-screens publishes', () => {
    expect([...PLAYGROUND_IMPORT_LIST].sort()).toEqual(
      ['@automata/framework', 'zod', ...publishedScreens()].sort(),
    )
  })

  it('refuse any other name, including a screens file that is not a published entry', () => {
    expect(isPlaygroundImport('@automata/framework')).toBe(true)
    expect(isPlaygroundImport('@automata/ui-screens/credits')).toBe(true)
    expect(isPlaygroundImport('@automata/ui-screens/words/ja.json')).toBe(false)
    expect(isPlaygroundImport('@automata/net')).toBe(false)
    expect(isPlaygroundImport('./other')).toBe(false)
  })

  it('map to one runtime file each: every screen to the one screens chunk', () => {
    const map = playgroundImportMap(RUNTIME)
    expect(map['@automata/framework']).toBe(RUNTIME.automata)
    expect(map.zod).toBe(RUNTIME.zod)
    for (const screen of publishedScreens()) expect(map[screen]).toBe(RUNTIME.uiScreens)
    expect(Object.keys(map).sort()).toEqual([...PLAYGROUND_IMPORT_LIST].sort())
  })
})
