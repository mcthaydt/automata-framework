import { expect, test } from 'vitest'
import { checkFile } from './style'

const sys =
  "import { defineSystem } from 'x'\nexport const moveSystem = defineSystem({ name: 'move', phase: 'gameplay', run() {} })\n"
const comp =
  "import { defineComponent } from 'x'\nexport const Health = defineComponent('health', { hp: 'i32' })\n"
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
] as const)('%s -> %s', (name, code, rule, message) => {
  const findings = checkFile(`/p/src/${name}`, code)
  expect(findings.map((f) => f.rule)).toEqual([rule])
  expect(findings[0]?.message).toContain(message)
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
