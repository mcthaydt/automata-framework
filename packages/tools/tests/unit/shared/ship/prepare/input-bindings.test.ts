import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  declaredInputsIn,
  findInputsProblems,
  keysBindingsIn,
} from '#src/shared/ship/prepare/input-bindings.ts'
import { inputsProblems } from '#src/shared/ship/targets/ruken/check-inputs.ts'

// The inputs check (M4.1 follow-up): `runtime.inputs` against the game's input map, read from the `keys()` calls in
// its sources because the map cannot be loaded under plain Node. `inputsProblems` stays the one owner of the rule;
// this builds the bindings it takes. What cannot be read as a literal can only add a device, never remove one, so a
// problem it reports is always real.

function game(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'inputs-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const IMPORT = "import { keys } from '@automataframework/automata-game'\n"
/** A file whose `keys(...)` call sits at line 2, column 22. */
const call = (args: string) => `${IMPORT}export const input = keys(${args})\n`
const WHERE = 'src/game.ts:2:22'

describe('keysBindingsIn', () => {
  it('reads key bindings as touch buttons, which is what keys() makes of them', () => {
    expect(keysBindingsIn('src/game.ts', call('Move, { ArrowLeft: { x: -1 }, KeyA: { x: -1 } }'))).toEqual({
      [`${WHERE} keys`]: { touch: true },
    })
  })

  it('reads touch: false as no touch buttons, and a pad option as pad buttons', () => {
    expect(
      keysBindingsIn(
        'src/game.ts',
        call('Move, { KeyA: { x: -1 } }, { touch: false, pad: { 14: {}, 15: {} } }'),
      ),
    ).toEqual({
      [`${WHERE} keys`]: { touch: false },
      [`${WHERE} pad`]: { pad: [14, 15] },
    })
  })

  it('reads gestures as touch gestures', () => {
    expect(
      keysBindingsIn(
        'src/game.ts',
        call("Steer, {}, { touch: false, gestures: { 'swipe-left': {}, 'flick-down': {} } }"),
      ),
    ).toEqual({
      [`${WHERE} keys`]: { touch: false },
      [`${WHERE} gestures`]: { gesture: ['swipe-left', 'flick-down'] },
    })
  })

  it('reads no key bindings as no touch buttons', () => {
    expect(keysBindingsIn('src/game.ts', call('Move, {}'))).toEqual({ [`${WHERE} keys`]: { touch: false } })
  })

  it('counts what it cannot read as touchable and binds no pad for it, so it never reports what it cannot prove', () => {
    expect(keysBindingsIn('src/game.ts', call('Move, BINDINGS'))).toEqual({
      [`${WHERE} keys`]: { touch: true },
    })
    expect(keysBindingsIn('src/game.ts', call('Move, { KeyA: {} }, { touch: shown, pad: PAD }'))).toEqual({
      [`${WHERE} keys`]: { touch: true },
    })
    expect(keysBindingsIn('src/game.ts', call('Move, { KeyA: {} }, { ...shared }'))).toEqual({
      [`${WHERE} keys`]: { touch: true },
    })
    expect(
      keysBindingsIn('src/game.ts', call('Move, BINDINGS, { touch: false, gestures: GESTURES }')),
    ).toEqual({
      [`${WHERE} keys`]: { touch: false },
      [`${WHERE} gestures`]: { gesture: ['(unreadable)'] },
    })
    expect(keysBindingsIn('src/game.ts', call('Move, { KeyA: {}, ...more }'))).toEqual({
      [`${WHERE} keys`]: { touch: true },
    })
  })

  it('reads every keys() call in a file, and follows an aliased import', () => {
    const code = `import { keys as inputKeys } from '@automataframework/automata'
export const a = inputKeys(Move, { KeyA: {} })
export const b = inputKeys(Move, {}, { pad: { 0: {} } })
`
    expect(keysBindingsIn('src/game.ts', code)).toEqual({
      'src/game.ts:2:18 keys': { touch: true },
      'src/game.ts:3:18 keys': { touch: false },
      'src/game.ts:3:18 pad': { pad: [0] },
    })
  })

  it('does not read Object.keys, a local keys, or a keys imported from elsewhere', () => {
    expect(keysBindingsIn('src/game.ts', 'export const names = Object.keys(table)\n')).toEqual({})
    expect(
      keysBindingsIn('src/game.ts', 'const keys = (a) => a\nexport const k = keys(1, { a: 1 })\n'),
    ).toEqual({})
    expect(
      keysBindingsIn('src/game.ts', "import { keys } from 'lodash'\nexport const k = keys({ a: 1 })\n"),
    ).toEqual({})
  })

  it('is undefined for a file that does not parse, since a half-read tree could name a device that is not there', () => {
    expect(keysBindingsIn('src/game.ts', `${IMPORT}keys(Move, {`)).toBeUndefined()
  })
})

describe('declaredInputsIn', () => {
  it('reads the literal runtime.inputs of a ship config as written, at its opening bracket', () => {
    expect(
      declaredInputsIn("export default defineShipConfig({ runtime: { inputs: ['touch', 'keyboard'] } })"),
    ).toEqual({ inputs: ['touch', 'keyboard'], line: 1, col: 54 })
  })

  it('is undefined when runtime or its inputs are not written as literals, or the file does not parse', () => {
    expect(declaredInputsIn("export default defineShipConfig({ game: { id: 'g' } })")).toBeUndefined()
    expect(
      declaredInputsIn('export default defineShipConfig({ runtime: { inputs: INPUTS } })'),
    ).toBeUndefined()
    expect(
      declaredInputsIn("export default defineShipConfig({ runtime: { inputs: ['touch', other] } })"),
    ).toBeUndefined()
    expect(declaredInputsIn('export default defineShipConfig({ runtime: shared })')).toBeUndefined()
    expect(declaredInputsIn('export default defineShipConfig({ runtime: {')).toBeUndefined()
  })
})

describe('findInputsProblems', () => {
  const padGame = call('Move, { KeyA: { x: -1 } }, { pad: { 14: { x: -1 } } }')

  it("reports a pad binding the config does not declare, with the rule's own words", () => {
    const dir = game({ 'src/game.ts': padGame })
    expect(findInputsProblems(dir, ['touch', 'keyboard'])).toEqual([
      `action "${WHERE} pad" binds pad buttons but runtime.inputs has no "gamepad"`,
    ])
    expect(findInputsProblems(dir, ['touch', 'keyboard'])).toEqual(
      inputsProblems(['touch', 'keyboard'], {
        [`${WHERE} keys`]: { touch: true },
        [`${WHERE} pad`]: { pad: [14] },
      }),
    )
  })

  it('reports touch declared with nothing to touch', () => {
    const dir = game({ 'src/game.ts': call('Move, { KeyA: {} }, { touch: false }') })
    expect(findInputsProblems(dir, ['touch', 'keyboard'])).toEqual([
      'runtime.inputs declares "touch" but no action binds a touch button or a gesture',
    ])
  })

  it('passes a config that agrees', () => {
    expect(findInputsProblems(game({ 'src/game.ts': padGame }), ['touch', 'gamepad', 'keyboard'])).toEqual([])
  })

  it('finds nothing in a game with no keys() call, or when the only call is in a test, node_modules or the build', () => {
    const dir = game({
      'src/page.ts': 'export const page = 1\n',
      'src/game.test.ts': padGame,
      'node_modules/x/index.ts': padGame,
      'dist/assets/index.js': padGame,
    })
    expect(findInputsProblems(dir, ['touch', 'keyboard'])).toEqual([])
  })

  it('reads the calls of every file together: a touch button in one file is touch for the game', () => {
    const dir = game({
      'src/menu.ts': call('Menu, {}, { touch: false }'),
      'src/play.ts': call('Move, { KeyA: {} }'),
    })
    expect(findInputsProblems(dir, ['touch', 'keyboard'])).toEqual([])
  })
})
