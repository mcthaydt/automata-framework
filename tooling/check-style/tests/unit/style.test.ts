import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { checkFile, checkGameRoot, MAX_SOURCE_LINES } from '#src/style.ts'

const sys =
  "import { defineSystem } from 'x'\nexport const moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} })\n"
const comp =
  "import { defineComponent } from 'x'\nexport const Health = defineComponent('health', { hp: 'i32' })\n"
const schema =
  "import { defineContentSchema } from 'x'\nexport const Rooms = defineContentSchema('rooms', {})\n"
const gen =
  "import { defineContentGenerator } from 'x'\nexport const Palette = defineContentGenerator('palette', {})\n"
const ext =
  "import { defineExtension } from 'x'\nexport const physics = defineExtension({ name: 'physics' })\n"
const plain = 'export function clamp(x: number): number {\n  return x\n}\n'

test.each([
  ['movement.system.ts', sys],
  ['health.component.ts', comp],
  ['math-utils.ts', plain],
  ['index.ts', "export { x } from './y'\n"],
  ['save.manager.ts', 'export class SaveManager {}\n'],
  // Svelte 5 rune modules must end in .svelte.ts; ".svelte" is Svelte's marker, not a role.
  ['room-store.svelte.ts', plain],
  ['save.manager.svelte.ts', 'export class SaveManager {}\n'],
  ['rooms.content.ts', schema],
  ['palette.generator.ts', gen],
  ['physics.extension.ts', ext],
])('%s is fine', (name, code) => {
  expect(checkFile(`/p/src/${name}`, code)).toEqual([])
})

test.each([
  ['movement.ts', sys, 'role-suffix', 'exports a defineSystem result, so the file must be named *.system.ts'],
  [
    'health.component.ts',
    sys,
    'role-mismatch',
    'a *.component.ts file may only export defineComponent results',
  ],
  [
    'empty.system.ts',
    plain,
    'role-missing',
    'a *.system.ts file must export at least one defineSystem result',
  ],
  ['BadName.ts', plain, 'file-name', 'kebab-case'],
  ['weird.foo.ts', plain, 'file-name', 'unknown role "foo"'],
  ['two_words.ts', plain, 'file-name', 'kebab-case'],
  ['RoomStore.svelte.ts', plain, 'file-name', 'kebab-case'],
  ['weird.foo.svelte.ts', plain, 'file-name', 'unknown role "foo"'],
  ['movement.svelte.ts', sys, 'role-suffix', 'must be named *.system.ts'],
  ['rooms.ts', schema, 'role-suffix', 'must be named *.content.ts'],
  ['palette.ts', gen, 'role-suffix', 'must be named *.generator.ts'],
  ['physics.ts', ext, 'role-suffix', 'must be named *.extension.ts'],
  ['empty.content.ts', plain, 'role-missing', 'must export at least one defineContentSchema result'],
] as const)('%s -> %s', (name, code, rule, message) => {
  const findings = checkFile(`/p/src/${name}`, code)
  expect(findings.map((f) => f.rule)).toEqual([rule])
  expect(findings[0]?.message).toContain(message)
})

test('a game may keep its content options in content.config.ts, a plain module that registers nothing', () => {
  expect(checkFile('/p/src/content.config.ts', 'export const contentConfig = { schemas: [] }\n')).toEqual([])
})

test('a role file may export several definitions of its own role and plain helpers alongside', () => {
  const code = `${comp}export const Mana = defineComponent('mana', { mp: 'i32' })\nexport const MAX = 9\n`
  expect(checkFile('/p/src/stats.component.ts', code)).toEqual([])
})

test.each([
  [
    'movement.ts',
    "import { defineSystem } from 'x'\nconst moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} })\nexport { moveSystem }\n",
    'role-suffix',
  ],
  [
    'movement.system.ts',
    "import { defineSystem } from 'x'\nconst moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} })\nexport { moveSystem }\n",
    undefined,
  ],
  [
    'movement.system.ts',
    "import { defineSystem } from 'x'\nconst moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} })\nexport default moveSystem\n",
    undefined,
  ],
  [
    'movement.ts',
    "import { defineSystem } from 'x'\nexport const moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} }) as const\n",
    'role-suffix',
  ],
  ['p.ts', 'export const x = toString({})\n', undefined],
] as const)('%s - extra cases', (name, code, expectedRule) => {
  const findings = checkFile(`/p/src/${name}`, code)
  if (expectedRule) {
    expect(findings.map((f) => f.rule)).toEqual([expectedRule])
  } else {
    expect(findings).toEqual([])
  }
})

describe('the 600-line ceiling on non-test source (QB spec §4.1)', () => {
  const lines = (count: number): string =>
    `${Array.from({ length: count }, (_, index) => `export const value${index} = ${index}`).join('\n')}\n`

  test('a 600-line file is fine', () => {
    expect(checkFile('/p/src/long-file.ts', lines(MAX_SOURCE_LINES))).toEqual([])
  })

  test('a 601-line file fails with its length and the ceiling', () => {
    const findings = checkFile('/p/src/long-file.ts', lines(601))
    expect(findings.map((f) => f.rule)).toEqual(['file-length'])
    expect(findings[0]?.message).toContain('601 lines')
    expect(findings[0]?.message).toContain('600')
  })

  test('applies to index.ts too, which skips the naming rules', () => {
    expect(checkFile('/p/src/index.ts', lines(601)).map((f) => f.rule)).toEqual(['file-length'])
  })
})

describe('a game root groups its sim by role (GL spec §5.1, acceptance A1–A11)', () => {
  const game = '/g/src'
  const inGame = (path: string, code: string) => checkFile(`${game}/${path}`, code, { gameRoot: game })
  const rules = (path: string, code: string) => inGame(path, code).map((f) => f.rule)
  const cmd = "import { defineCommand } from 'x'\nexport const Jump = defineCommand('jump', {})\n"
  const evt = "import { defineEvent } from 'x'\nexport const Landed = defineEvent('landed', {})\n"
  const res = "import { defineResource } from 'x'\nexport const Score = defineResource('score', 0)\n"
  const plugin =
    "import { definePlugin } from 'x'\nexport const gamePlugin = definePlugin({ name: 'game' })\n"
  const gameDef = "import { defineGame } from 'x'\nexport const game = defineGame({})\n"

  test.each([
    ['components.ts', comp],
    ['commands.ts', cmd],
    ['events.ts', evt],
    ['resources.ts', res],
    ['systems.ts', `${sys}export function clampSpeed(x: number): number {\n  return x\n}\n`],
    ['state.ts', plugin],
    ['constants.ts', 'export const SPEED = 3 // px per tick\n'],
    ['views.ts', plain],
    ['main.ts', gameDef], // A7
    ['systems/player-move.ts', sys], // A4
    ['systems/tiles.ts', plain], // A4: helpers only
    ['systems/jump.system.ts', sys], // a matching suffix is redundant but allowed
    ['state/setup.ts', plugin],
    ['views/hud.ts', plain],
    ['player.component.ts', comp], // A8: today's form still passes
    ['content/rooms.content.ts', schema],
  ])('%s passes', (path, code) => {
    expect(inGame(path, code)).toEqual([])
  })

  test('A1: components.ts exporting a defineSystem result fails role-mismatch', () => {
    const findings = inGame('components.ts', sys)
    expect(findings.map((f) => f.rule)).toEqual(['role-mismatch'])
    expect(findings[0]?.message).toBe('components.ts may only export defineComponent results')
  })

  test('A2: systems.ts exporting no defineSystem result fails role-missing', () => {
    const findings = inGame('systems.ts', plain)
    expect(findings.map((f) => f.rule)).toEqual(['role-missing'])
    expect(findings[0]?.message).toBe('systems.ts must export at least one defineSystem result')
  })

  test('A3: state.ts holds only the plugin; a system or a resource there fails role-mismatch', () => {
    expect(rules('state.ts', `${plugin}${sys.split('\n')[1]}\n`)).toEqual(['role-mismatch'])
    const findings = inGame('state.ts', `${plugin}${res.split('\n')[1]}\n`)
    expect(findings.map((f) => f.rule)).toEqual(['role-mismatch'])
    expect(findings[0]?.message).toBe('state.ts may only export definePlugin results')
  })

  test('A4: a file in a role folder keeps the folder role', () => {
    const findings = inGame('systems/player.ts', comp)
    expect(findings.map((f) => f.rule)).toEqual(['role-mismatch'])
    expect(findings[0]?.message).toBe('a file in systems/ may only export defineSystem results')
    const named = inGame('systems/jump.component.ts', comp)
    expect(named.map((f) => f.rule)).toEqual(['file-name'])
    expect(named[0]?.message).toBe('a *.component.ts file does not belong in systems/')
  })

  test('A6: constants.ts exporting a defineComponent result fails role-suffix, naming components.ts', () => {
    const findings = inGame('constants.ts', comp)
    expect(findings.map((f) => f.rule)).toEqual(['role-suffix'])
    expect(findings[0]?.message).toBe(
      'exports a defineComponent result, so it belongs in components.ts (or components/), or a file named *.component.ts',
    )
  })

  test('a game file with no role path and no suffix names both forms', () => {
    expect(inGame('movement.ts', sys)[0]?.message).toBe(
      'exports a defineSystem result, so it belongs in systems.ts (or systems/), or a file named *.system.ts',
    )
    expect(inGame('views/hud.ts', comp).map((f) => f.rule)).toEqual(['role-suffix'])
  })

  test('A9: in a package root the role names are ordinary files', () => {
    expect(checkFile('/p/src/components.ts', comp).map((f) => f.rule)).toEqual(['role-suffix'])
    expect(checkFile('/p/src/commands/undo.ts', plain)).toEqual([])
    expect(checkFile('/p/src/views/rect.ts', plain)).toEqual([])
    // a file outside the game root keeps today's rules even when a game root is passed
    expect(checkFile('/p/src/components.ts', comp, { gameRoot: game }).map((f) => f.rule)).toEqual([
      'role-suffix',
    ])
  })

  test('A11: a 601-line role file fails file-length', () => {
    const long = `${comp}${Array.from({ length: 599 }, (_, index) => `export const v${index} = ${index}`).join('\n')}\n`
    expect(rules('components.ts', long)).toEqual(['file-length'])
  })

  test('A5: a role as both a file and a folder fails role-split', () => {
    const dir = mkdtempSync(join(tmpdir(), 'game-root-'))
    writeFileSync(join(dir, 'systems.ts'), sys)
    mkdirSync(join(dir, 'systems'))
    writeFileSync(join(dir, 'systems', 'goal.ts'), sys)
    writeFileSync(join(dir, 'views.ts'), plain)
    const findings = checkGameRoot(dir)
    expect(findings.map((f) => [f.file, f.rule])).toEqual([[join(dir, 'systems.ts'), 'role-split']])
    expect(findings[0]?.message).toBe('systems.ts and systems/ both exist; move systems.ts into systems/')
  })
})

// A comment should say why, not which plan asked for the code (refactor spec §8, task 7.2). The rule is opt-in: it is
// switched on per root with `planComments`, so a package turns it on when its comments have been rewritten.
describe('comments that cite a plan', () => {
  const MESSAGE = 'A comment should say why, not which plan asked for it. Explain the reason in plain words.'
  const check = (code: string) => checkFile('/p/src/a.ts', code, { planComments: true })

  test.each([
    ['// M5.2 owns this\nexport const a = 1\n', 1],
    ['export const a = 1 // (DX.2d) the words\n', 1],
    ['/** Chosen in PRODUCT.2 plan U-3. */\nexport const a = 1\n', 1],
    ['/*\n * See spec §3.1 for the reason.\n */\nexport const a = 1\n', 2],
  ])('%j is flagged', (code, line) => {
    expect(check(code)).toEqual([{ file: '/p/src/a.ts', rule: 'plan-comment', message: MESSAGE, line }])
  })

  test.each([
    '// The Pixi default is 1, too blurry on an iPad\nexport const a = 1\n',
    "export const a = 'M5.2'\n",
    "export const url = 'https://example.com/#M5.2' // the site\n",
    '// Version 5.2 of the format added a field\nexport const a = 1\n',
  ])('%j passes', (code) => {
    expect(check(code)).toEqual([])
  })

  test('is off unless asked for', () => {
    expect(checkFile('/p/src/a.ts', '// M5.2 owns this\nexport const a = 1\n')).toEqual([])
  })
})
