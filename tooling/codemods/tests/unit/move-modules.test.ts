import { describe, expect, it } from 'vitest'
import { type MoveMap, planModules } from '#src/move-modules.ts'

// Core and 2D refactor plan, task 4.2: the module-move codemod. The plan is pure, so these tests give it a file
// system in memory: `files` maps a path to its text.

const ROOT = '/repo'
const abs = (path: string): string => `${ROOT}/${path}`

function run(files: Readonly<Record<string, string>>, map: MoveMap) {
  const absolute = new Map(Object.entries(files).map(([path, text]) => [abs(path), text]))
  const plan = planModules(ROOT, map, [...absolute.keys()], (path) => absolute.get(path) ?? '')
  const where = Object.fromEntries(
    plan.moves.map((move) => [move.from.slice(ROOT.length + 1), move.to.slice(ROOT.length + 1)]),
  )
  // The text a file has after the run: its rewrite (kept under its new path) or, when only its place changed, its own.
  const text = (path: string): string => {
    const found = plan.rewrites.get(abs(where[path] ?? path)) ?? files[path]
    if (found === undefined) throw new Error(`${path} is not in the fixture`)
    return found
  }
  return { plan, where, text }
}

const MAP: MoveMap = {
  sources: ['packages/runtime', 'packages/ui'],
  moves: [
    { from: 'packages/runtime/src/audio', to: 'packages/automata/src/features/audio' },
    { from: 'packages/runtime/src/save', to: 'packages/automata/src/features/saves' },
    { from: 'packages/runtime/src/index.ts', to: 'packages/automata/src/entries/from-runtime.ts' },
    { from: 'packages/ui/src/controls', to: 'packages/automata/src/shared/ui/controls' },
    { from: 'packages/ui/src/index.ts', to: 'packages/automata/src/entries/from-ui.ts' },
  ],
  entries: {
    '@mcthaydt/automata-runtime': '@mcthaydt/automata',
    '@mcthaydt/automata-ui': '@mcthaydt/automata',
    '@mcthaydt/automata-ui/testing': '@mcthaydt/automata/testing',
  },
}

describe('which files move where', () => {
  it('moves a file by the longest matching row, keeping what follows the matched prefix', () => {
    const { where } = run(
      {
        'packages/runtime/src/audio/audio.manager.ts': 'export const a = 1\n',
        'packages/runtime/src/audio/sub/mix.ts': 'export const b = 1\n',
        'packages/runtime/src/index.ts': "export * from './audio/audio.manager.ts'\n",
      },
      MAP,
    )
    expect(where).toEqual({
      'packages/runtime/src/audio/audio.manager.ts': 'packages/automata/src/features/audio/audio.manager.ts',
      'packages/runtime/src/audio/sub/mix.ts': 'packages/automata/src/features/audio/sub/mix.ts',
      'packages/runtime/src/index.ts': 'packages/automata/src/entries/from-runtime.ts',
    })
  })

  it('lets a file row beat the folder row that contains it', () => {
    const { where } = run(
      {
        'packages/runtime/src/audio/target.ts': 'export {}\n',
        'packages/runtime/src/audio/a.ts': 'export {}\n',
      },
      {
        ...MAP,
        moves: [
          ...MAP.moves,
          { from: 'packages/runtime/src/audio/target.ts', to: 'packages/automata/src/entries/target.ts' },
        ],
      },
    )
    expect(where['packages/runtime/src/audio/target.ts']).toBe('packages/automata/src/entries/target.ts')
    expect(where['packages/runtime/src/audio/a.ts']).toBe('packages/automata/src/features/audio/a.ts')
  })

  it('names a file under a source package that no row covers, and does not guess', () => {
    const { plan } = run({ 'packages/runtime/src/mystery/x.ts': 'export {}\n' }, MAP)
    expect(plan.unmapped).toEqual([abs('packages/runtime/src/mystery/x.ts')])
    expect(plan.moves).toEqual([])
  })

  it('names two files that land on one path', () => {
    const { plan } = run(
      { 'packages/runtime/src/audio/x.ts': 'export {}\n', 'packages/ui/src/x.ts': 'export const x = 1\n' },
      {
        ...MAP,
        moves: [
          ...MAP.moves,
          { from: 'packages/ui/src/x.ts', to: 'packages/automata/src/features/audio/x.ts' },
        ],
      },
    )
    expect(plan.clashes).toEqual([
      {
        to: abs('packages/automata/src/features/audio/x.ts'),
        from: [abs('packages/runtime/src/audio/x.ts'), abs('packages/ui/src/x.ts')],
      },
    ])
  })
})

describe('two files, one path', () => {
  const extra = {
    ...MAP,
    moves: [
      ...MAP.moves,
      { from: 'packages/ui/src/setup.ts', to: 'packages/automata/src/features/audio/setup.ts' },
    ],
  }

  it('keeps one and removes the other when their text is the same', () => {
    const { plan } = run(
      { 'packages/runtime/src/audio/setup.ts': 'export {}\n', 'packages/ui/src/setup.ts': 'export {}\n' },
      extra,
    )
    expect(plan.clashes).toEqual([])
    expect(plan.removed).toEqual([abs('packages/ui/src/setup.ts')])
    expect(plan.moves).toEqual([
      {
        from: abs('packages/runtime/src/audio/setup.ts'),
        to: abs('packages/automata/src/features/audio/setup.ts'),
      },
    ])
  })

  it('stops when their text differs', () => {
    const { plan } = run(
      {
        'packages/runtime/src/audio/setup.ts': 'export {}\n',
        'packages/ui/src/setup.ts': 'export const x = 1\n',
      },
      extra,
    )
    expect(plan.clashes).toHaveLength(1)
  })
})

describe('where a test goes', () => {
  it('follows the source file it tests, into tests/<kind>/<feature>/', () => {
    const { where } = run(
      {
        'packages/runtime/src/audio/audio.manager.ts': 'export {}\n',
        'packages/runtime/tests/unit/audio/audio.manager.test.ts': 'export {}\n',
        'packages/runtime/tests/browser/save/save.manager.test.ts': 'export {}\n',
        'packages/ui/tests/unit/controls/button.test.ts': 'export {}\n',
      },
      MAP,
    )
    expect(where['packages/runtime/tests/unit/audio/audio.manager.test.ts']).toBe(
      'packages/automata/tests/unit/audio/audio.manager.test.ts',
    )
    expect(where['packages/runtime/tests/browser/save/save.manager.test.ts']).toBe(
      'packages/automata/tests/browser/saves/save.manager.test.ts',
    )
    expect(where['packages/ui/tests/unit/controls/button.test.ts']).toBe(
      'packages/automata/tests/unit/shared/ui/controls/button.test.ts',
    )
  })

  it('lets an explicit row beat the derived one', () => {
    const { where } = run(
      { 'packages/runtime/tests/unit/ruken/frame.test.ts': 'export {}\n' },
      {
        ...MAP,
        moves: [
          ...MAP.moves,
          { from: 'packages/runtime/tests/unit/ruken', to: 'packages/automata/tests/unit/targets/ruken' },
        ],
      },
    )
    expect(where['packages/runtime/tests/unit/ruken/frame.test.ts']).toBe(
      'packages/automata/tests/unit/targets/ruken/frame.test.ts',
    )
  })
})

describe('rewriting imports', () => {
  it('points a relative import at the new place of its target, from the new place of the importer', () => {
    const { text } = run(
      {
        'packages/runtime/src/audio/audio.manager.ts':
          "import { Slot } from '../save/save.manager.ts'\nexport const a = Slot\n",
        'packages/runtime/src/save/save.manager.ts':
          "import { helper } from './helper.ts'\nexport const Slot = helper\n",
        'packages/runtime/src/save/helper.ts': 'export const helper = 1\n',
      },
      MAP,
    )
    expect(text('packages/runtime/src/audio/audio.manager.ts')).toBe(
      "import { Slot } from '../saves/save.manager.ts'\nexport const a = Slot\n",
    )
    expect(text('packages/runtime/src/save/save.manager.ts')).toBe(
      "import { helper } from './helper.ts'\nexport const Slot = helper\n",
    )
  })

  it('keeps an extensionless specifier extensionless, and a folder import a folder import', () => {
    const { text } = run(
      {
        'packages/runtime/src/audio/a.ts': "import './b'\nimport './sub'\nexport {}\n",
        'packages/runtime/src/audio/b.ts': 'export {}\n',
        'packages/runtime/src/audio/sub/index.ts': 'export {}\n',
        'packages/runtime/src/index.ts': "export { a } from './audio/a'\n",
      },
      MAP,
    )
    expect(text('packages/runtime/src/audio/a.ts')).toBe("import './b'\nimport './sub'\nexport {}\n")
    expect(text('packages/runtime/src/index.ts')).toBe("export { a } from '../features/audio/a'\n")
  })

  it('rewrites a #src import in a test to the new path, and a test file that moves keeps working', () => {
    const { text } = run(
      {
        'packages/runtime/src/save/save.manager.ts': 'export {}\n',
        'packages/runtime/tests/unit/save/save.manager.test.ts':
          "import { x } from '#src/save/save.manager.ts'\n",
      },
      MAP,
    )
    expect(text('packages/runtime/tests/unit/save/save.manager.test.ts')).toBe(
      "import { x } from '#src/features/saves/save.manager.ts'\n",
    )
  })

  it('rewrites a bare import of an old package in a consumer, by the entry map', () => {
    const { text } = run(
      {
        'packages/runtime/src/index.ts': 'export {}\n',
        'packages/editor-kit/src/a.ts':
          "import { Slot } from '@mcthaydt/automata-runtime'\nimport type { B } from '@mcthaydt/automata-ui/testing'\n",
      },
      MAP,
    )
    expect(text('packages/editor-kit/src/a.ts')).toBe(
      "import { Slot } from '@mcthaydt/automata'\nimport type { B } from '@mcthaydt/automata/testing'\n",
    )
  })

  it('splits one import in two when its names now come from two entries', () => {
    const { text } = run(
      {
        'tooling/x/src/a.ts':
          "import { createSimTest, mount as m, type Fake } from '@mcthaydt/automata-testing'\n",
      },
      {
        ...MAP,
        entries: {
          ...MAP.entries,
          '@mcthaydt/automata-testing': {
            to: '@mcthaydt/automata/testing',
            names: { createSimTest: '@mcthaydt/automata-sim/testing' },
          },
        },
      },
    )
    expect(text('tooling/x/src/a.ts')).toBe(
      "import { createSimTest } from '@mcthaydt/automata-sim/testing'\nimport { mount as m, type Fake } from '@mcthaydt/automata/testing'\n",
    )
  })

  it('rewrites an old specifier in a config file and in a Svelte script', () => {
    const { text } = run(
      {
        'packages/editor-kit/vite.config.ts': "import { x } from '@mcthaydt/automata-ui'\nexport default x\n",
        'packages/editor-kit/src/A.svelte':
          '<script lang="ts">\n  import { Button } from \'@mcthaydt/automata-ui\'\n</script>\n',
      },
      MAP,
    )
    expect(text('packages/editor-kit/vite.config.ts')).toContain("from '@mcthaydt/automata'")
    expect(text('packages/editor-kit/src/A.svelte')).toContain("from '@mcthaydt/automata'")
  })

  it('leaves a file alone when nothing in it changes', () => {
    const { plan } = run(
      { 'packages/editor-kit/src/a.ts': "import { z } from 'zod'\nexport const a = z\n" },
      MAP,
    )
    expect(plan.rewrites.size).toBe(0)
  })
})

describe('the reports', () => {
  it('lists the names each consumer imports from an old entry (the surface report)', () => {
    const { plan } = run(
      {
        'packages/editor-kit/src/a.ts': "import { Slot, Other } from '@mcthaydt/automata-runtime'\n",
        'packages/editor-3d/src/b.ts':
          "import { Slot } from '@mcthaydt/automata-runtime'\nimport * as ui from '@mcthaydt/automata-ui'\n",
      },
      MAP,
    )
    expect(plan.surface).toEqual([
      { consumer: 'packages/editor-3d/src/b.ts', from: '@mcthaydt/automata-runtime', names: ['Slot'] },
      { consumer: 'packages/editor-3d/src/b.ts', from: '@mcthaydt/automata-ui', names: ['*'] },
      {
        consumer: 'packages/editor-kit/src/a.ts',
        from: '@mcthaydt/automata-runtime',
        names: ['Other', 'Slot'],
      },
    ])
  })

  it('lists the old-package imports inside the merged package, which the build step resolves to relative imports', () => {
    const { plan } = run(
      {
        'packages/runtime/src/audio/a.ts': "import { Button } from '@mcthaydt/automata-ui'\nexport {}\n",
        'packages/ui/src/index.ts': 'export {}\n',
      },
      MAP,
    )
    expect(plan.intra).toEqual([
      { file: 'packages/runtime/src/audio/a.ts', from: '@mcthaydt/automata-ui', names: ['Button'] },
    ])
  })
})
