import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { checkSource } from '#src/features/boundaries/check.ts'
import { collectSources } from '#src/features/boundaries/files.ts'

const fixture = (name: string) => {
  const path = join(import.meta.dirname, '../../fixtures/boundaries', name)
  return checkSource(path, readFileSync(path, 'utf8'))
}

test('the clean fixture (comments, strings, property keys, type positions, allowlisted Math) has no findings', () => {
  expect(fixture('clean.ts')).toEqual([])
})

test.each([
  ['global-date.ts', 'banned-global', 1, 11],
  ['global-window.ts', 'banned-global', 1, 18],
  ['global-timer.ts', 'banned-global', 1, 1],
  ['global-function.ts', 'banned-global', 1, 22],
  ['math-random.ts', 'math-member', 1, 18],
  ['math-sin.ts', 'math-member', 1, 18],
  ['pow-operator.ts', 'pow-operator', 1, 18],
  ['pow-assign.ts', 'pow-operator', 2, 1],
  ['object-keys.ts', 'key-enumeration', 1, 18],
  ['for-in.ts', 'key-enumeration', 2, 1],
  ['import-node.ts', 'import', 1, 1],
  ['import-dynamic.ts', 'import', 1, 28],
  ['import-effect.ts', 'import', 1, 1], // ADR 0003: no Effect inside the sim
  ['namespace-runtime.ts', 'math-member', 2, 20],
  ['object-alias.ts', 'key-enumeration', 1, 11],
  ['reflect-destructure.ts', 'key-enumeration', 1, 21],
  ['locale-compare.ts', 'locale', 1, 44],
  ['intl.ts', 'banned-global', 1, 22],
  // Audit bypasses (2026-10-11): each typechecked and passed before these rules.
  ['constructor-access.ts', 'banned-member', 1, 18], // reaches Function without naming it
  ['template-key.ts', 'key-enumeration', 1, 18],
  ['dynamic-key.ts', 'key-enumeration', 2, 18],
  ['global-weakref.ts', 'banned-global', 1, 22], // GC timing
  ['global-shared-buffer.ts', 'banned-global', 1, 22], // shared memory between threads
  ['global-atomics.ts', 'banned-global', 1, 18],
] as const)('%s -> %s at %i:%i', (file, rule, line, col) => {
  const findings = fixture(file)
  expect(findings.map((f) => [f.rule, f.line, f.col])).toEqual([[rule, line, col]])
})

test('util/sorted.ts may enumerate keys (it is the sanctioned implementation); other rules still apply', () => {
  const src = 'export const k = (o: object) => Object.keys(o).sort()\nexport const r = Math.random()\n'
  expect(checkSource('/x/packages/sim/src/util/sorted.ts', src).map((f) => f.rule)).toEqual(['math-member'])
})

test('syntax errors are reported as a finding, not a crash', () => {
  expect(checkSource('/x/bad.ts', 'const = 1').map((f) => f.rule)).toEqual(['parse-error'])
})

test('a relative import that leaves the source root is reported; one inside it is not', () => {
  const root = '/repo/packages/sim/src'
  const file = `${root}/world/sim.ts`
  const src = "import { a } from '../util/sorted'\nimport { b } from '../../../content/src/x'\n"
  expect(checkSource(file, src, { root }).map((f) => [f.rule, f.line])).toEqual([['import', 2]])
})

test('collectSources finds every TS and JS module kind, skipping tests, declarations and other files', () => {
  const dir = join(import.meta.dirname, '../../fixtures/boundaries/tree')
  const names = collectSources(dir).map((f) => f.slice(dir.length + 1).replaceAll('\\', '/'))
  expect(names).toEqual(['a.ts', 'b.mts', 'c.cts', 'nested/d.js'])
})

test('collectSources leaves out a folder it is told to skip, wherever it sits', () => {
  const dir = join(import.meta.dirname, '../../fixtures/boundaries/tree')
  const names = collectSources(dir, ['nested']).map((f) => f.slice(dir.length + 1).replaceAll('\\', '/'))
  expect(names).toEqual(['a.ts', 'b.mts', 'c.cts'])
})

test('sim plugins outside packages/sim may import the sim’s public entry points, and only those', () => {
  const imports = (source: string) =>
    checkSource('/x/packages/physics/src/a.ts', `import { x } from '${source}'\n`).map((f) => f.rule)
  expect(imports('@automataframework/automata-sim')).toEqual([])
  expect(imports('@automataframework/automata-sim/math')).toEqual([])
  expect(imports('@automataframework/automata-sim/hash')).toEqual([])
  expect(imports('@automataframework/automata-sim/src/world/sim')).toEqual(['import'])
})

test('a game sim may import the entries its extension declares, and no other path of it', () => {
  const root = mkdtempSync(join(tmpdir(), 'af-boundaries-'))
  try {
    const installed = join(root, 'node_modules/@automataframework/automata-physics')
    mkdirSync(installed, { recursive: true })
    const simEntries = ['./2d', './3d']
    writeFileSync(
      join(installed, 'package.json'),
      JSON.stringify({ name: '@automataframework/automata-physics', automata: { simEntries } }),
    )
    const imports = (source: string) =>
      checkSource(join(root, 'src/sim/a.ts'), `import { x } from '${source}'\n`).map((f) => f.rule)
    expect(imports('@automataframework/automata-physics/2d')).toEqual([])
    expect(imports('@automataframework/automata-physics/3d')).toEqual([])
    expect(imports('@automataframework/automata-physics/src/2d')).toEqual(['import'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the checker names no extension: without a declaration an extension’s entry is refused as before', () => {
  const findings = checkSource(
    '/x/game/src/sim/a.ts',
    "import { x } from '@automataframework/automata-physics/2d'\n",
  )
  expect(findings.map((f) => [f.rule, f.message])).toEqual([
    ['import', 'import of "@automataframework/automata-physics/2d" is not allowed in the sim'],
  ])
})

test('a declaration problem is part of the import finding', () => {
  const root = mkdtempSync(join(tmpdir(), 'af-boundaries-'))
  try {
    const installed = join(root, 'node_modules/@x/ext')
    mkdirSync(installed, { recursive: true })
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ automata: { simEntries: '../up' } }))
    const [finding] = checkSource(join(root, 'src/sim/a.ts'), "import { x } from '@x/ext/2d'\n")
    expect(finding?.message).toContain('@x/ext declares automata.simEntries wrongly')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a root may allow another checked sim folder’s entry point by its exact name', () => {
  const imports = (source: string, allowImports: readonly string[] = []) =>
    checkSource('/x/demo/sim/a.ts', `import { x } from '${source}'\n`, { allowImports }).map((f) => f.rule)
  expect(imports('@af-games/emberwick/sim')).toEqual(['import'])
  expect(imports('@af-games/emberwick/sim', ['@af-games/emberwick/sim'])).toEqual([])
  // Exact names only: the package root (which reaches the host bridge) stays out.
  expect(imports('@af-games/emberwick', ['@af-games/emberwick/sim'])).toEqual(['import'])
})

// DX.6b: koota compiles struct-of-arrays accessors with `new Function`, which Ruken's CSP (no 'unsafe-eval') refuses.
describe('koota-soa: a koota trait or relation store must be a factory or a tag', () => {
  test.each([
    ['koota-object-schema.ts', 3, 31],
    ['koota-aliased.ts', 3, 37], // `import { trait as defineTrait }`
    ['koota-namespace.ts', 3, 35], // `koota.trait(...)`
    ['koota-schema-variable.ts', 4, 31], // `trait(schema)`: the checker cannot see that it is not an object
    ['koota-relation-store.ts', 3, 56], // `relation({ store: { ... } })` passes the store to `trait`
  ] as const)('%s -> koota-soa at %i:%i', (file, line, col) => {
    expect(fixture(file).map((f) => [f.rule, f.line, f.col])).toEqual([['koota-soa', line, col]])
  })

  test('the finding names the fix', () => {
    const [onTrait] = fixture('koota-object-schema.ts')
    expect(onTrait?.message).toContain('new Function')
    expect(onTrait?.message).toContain('defineComponent')
    expect(onTrait?.message).toContain('trait(() => ({ ... }))')
    const [onRelation] = fixture('koota-relation-store.ts')
    expect(onRelation?.message).toContain('relation({ store: () => ({ ... }) })')
  })

  test('factories, tags, relations without a store and a type-only import pass', () => {
    expect(fixture('koota-factory.ts')).toEqual([])
  })

  test('a function of the game’s own called `trait` is not koota’s', () => {
    expect(fixture('koota-unrelated.ts')).toEqual([])
  })

  const kootaRules = (src: string) => checkSource('/x/sim/a.ts', src).map((f) => [f.rule, f.line, f.col])
  test.each([
    ['a spread schema', "import { trait } from 'koota'\ntrait({ ...base })\n", 2, 7],
    ['a computed namespace member', "import * as k from 'koota'\nk['trait']({ x: 0 })\n", 2, 12],
    ['a call result', "import { trait } from 'koota'\ntrait(make())\n", 2, 7],
    ['a relation definition in a variable', "import { relation } from 'koota'\nrelation(options)\n", 2, 10],
    ['a spread relation definition', "import { relation } from 'koota'\nrelation({ ...options })\n", 2, 10],
    ['a relation store in a variable', "import { relation } from 'koota'\nrelation({ store: s })\n", 2, 19],
    ['a quoted store key', "import { relation } from 'koota'\nrelation({ ['store']: { n: 0 } })\n", 2, 23],
    ['an asserted object schema', "import { trait } from 'koota'\ntrait({ x: 0 } as const)\n", 2, 7],
    ['a parenthesized callee', "import { trait } from 'koota'\n(trait)({ x: 0 })\n", 2, 9],
    ['a sequence callee', "import { trait } from 'koota'\n(0, trait)({ x: 0 })\n", 2, 12],
    ['an asserted callee', "import { trait } from 'koota'\n(trait as typeof trait)({ x: 0 })\n", 2, 25],
    ['a sequence namespace callee', "import * as k from 'koota'\n(0, k.trait)({ x: 0 })\n", 2, 14],
    ['a parenthesized namespace', "import * as k from 'koota'\n(k).trait({ x: 0 })\n", 2, 11],
    ['a string-named import', "import { 'trait' as t } from 'koota'\nt({ x: 0 })\n", 2, 3],
    // koota reads `definition?.store`, which runs a getter; a method `store() {}` hands koota the function.
    [
      'a getter store',
      "import { relation } from 'koota'\nrelation({ get store() { return { a: 0 } } })\n",
      2,
      10,
    ],
  ] as const)('%s is reported', (_, src, line, col) => {
    expect(kootaRules(src)).toEqual([['koota-soa', line, col]])
  })

  test('parentheses and type assertions are read through, so the message says what the schema is', () => {
    const message = (src: string) =>
      checkSource('/x/sim/a.ts', `import { trait } from 'koota'\n${src}\n`)[0]?.message
    expect(message('trait(({ x: 0 }) satisfies object)')).toMatch(/^an object schema makes/)
    expect(message('trait(schema)')).toMatch(/^the checker cannot see/)
    expect(message('trait((() => ({ x: 0 })) as () => object)')).toBeUndefined()
    expect(message('trait({ x: 0 }!)')).toMatch(/^an object schema makes/)
    expect(message('trait(<object>{ x: 0 })')).toMatch(/^an object schema makes/)
  })

  test('a type-only specifier binds nothing, and a store method is a factory', () => {
    const src = [
      "import { type trait, relation } from 'koota'",
      'trait({ x: 0 })',
      'relation({ store() { return { n: 0 } } })',
      'relation({ store: { n: 0 } })',
      '',
    ].join('\n')
    expect(kootaRules(src)).toEqual([['koota-soa', 4, 19]])
  })
})

describe('inline mode (EX spec §4): only the sim inside a browser file is checked', () => {
  const inline = (name: string) => {
    const path = join(import.meta.dirname, '../../fixtures/boundaries/inline', name)
    return checkSource(path, readFileSync(path, 'utf8'), { inline: true }).map((f) => [f.rule, f.line, f.col])
  }

  test('Date.now() in a defineSystem callback is reported with its rule and line', () => {
    expect(inline('system-date.ts')).toEqual([['banned-global', 4, 41]])
  })

  test('Math.random() in definePlugin setup is reported', () => {
    expect(inline('plugin-random.ts')).toEqual([['math-member', 3, 81]])
  })

  test('the DOM, the clock, the console and any import at file level pass', () => {
    expect(inline('file-level-dom.ts')).toEqual([])
  })

  test('a clean system and plugin pass', () => {
    expect(inline('clean-system.ts')).toEqual([])
  })

  test('koota-soa covers the whole file: the CSP covers the whole page, and components are defined at file level', () => {
    expect(inline('koota-file-level.ts')).toEqual([['koota-soa', 5, 31]])
  })

  test('a koota call inside a defineSystem argument is reported once', () => {
    const src = [
      "import { defineSystem } from '@automataframework/automata'",
      "import { trait } from 'koota'",
      "export const s = defineSystem({ name: 's', run() { trait({ x: 0 }) } })",
      '',
    ].join('\n')
    const rules = checkSource('/x/demo/main.ts', src, { inline: true }).map((f) => [f.rule, f.line, f.col])
    expect(rules).toEqual([['koota-soa', 3, 58]])
  })
})

test('a folder walk never descends into installed packages or build output', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-boundaries-'))
  try {
    for (const sub of ['node_modules/pkg', 'dist', 'src']) mkdirSync(join(dir, sub), { recursive: true })
    for (const file of ['node_modules/pkg/index.js', 'dist/main.js', 'src/a.ts'])
      writeFileSync(join(dir, file), 'export {}\n')
    expect(collectSources(dir).map((f) => f.slice(dir.length + 1).replaceAll('\\', '/'))).toEqual([
      'src/a.ts',
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('simSet: a game laid out by role (GL spec §4.5)', () => {
  const src = '/g/src'
  const simSet = new Set([
    '/g/src/components.ts',
    '/g/src/state.ts',
    '/g/src/systems/index.ts',
    '/g/src/systems/move.ts',
  ])
  const check = (file: string, code: string) =>
    checkSource(file, code, { root: src, simSet }).map((f) => f.rule)

  test.each([
    ['a value import of another sim file', "import { A } from './components.ts'\nexport const a = A\n"],
    ['an extensionless import', "import { A } from './components'\nexport const a = A\n"],
    [
      'a NodeNext .js specifier for a .ts sim file',
      "import { A } from './components.js'\nexport const a = A\n",
    ],
    ['a folder import that resolves to index.ts', "import { m } from './systems'\nexport const s = m\n"],
    [
      'a type-only import from outside the sim',
      "import type { Room } from './content/room.ts'\nexport const r: Room[] = []\n",
    ],
    ['a dynamic import of a sim file', "export const load = () => import('./components.ts')\n"],
  ])('allows %s', (_name, code) => {
    expect(check('/g/src/state.ts', code)).toEqual([])
  })

  test.each([
    ['a value import from views.ts', "import { v } from './views.ts'\nexport const a = v\n"],
    ['a re-export from content/', "export { ROOM } from './content/room.ts'\n"],
    ['an escape above the game root', "import { x } from '../../shared/x.ts'\nexport const a = x\n"],
    ['a dynamic import of views.ts', "export const load = () => import('./views.ts')\n"],
  ])('refuses %s', (_name, code) => {
    expect(check('/g/src/state.ts', code)).toEqual(['import'])
  })

  test('the refusal names the sim set', () => {
    const [finding] = checkSource(
      '/g/src/systems/move.ts',
      "import { v } from '../views.ts'\nexport const a = v\n",
      {
        root: src,
        simSet,
      },
    )
    expect(finding?.message).toContain(
      'the sim imports ../views.ts, which is outside the sim (constants, components, commands, events, resources, systems, state, sim.ts)',
    )
  })
})
