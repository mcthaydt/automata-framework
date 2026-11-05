import { describe, expect, it } from 'vitest'
import { inputsProblems } from '#src/features/ship/targets/ruken/check-inputs.ts'

// M4 spec §4.13 (I-g): `runtime.inputs` (Ruken's INPUTS) must agree with the game's input profile.
describe('inputsProblems', () => {
  const keyboardOnly = { left: { keys: ['ArrowLeft'], pad: [], touch: false } }

  it('accepts a manifest that declares every device the profile binds', () => {
    expect(inputsProblems(['keyboard'], keyboardOnly)).toEqual([])
    expect(
      inputsProblems(['touch', 'keyboard', 'gamepad'], {
        jump: { pad: [0], touch: true },
        left: { pad: [14] },
      }),
    ).toEqual([])
  })

  it('refuses pad buttons when runtime.inputs has no gamepad, naming each action', () => {
    expect(
      inputsProblems(['keyboard', 'touch'], { left: { pad: [14], touch: true }, jump: { pad: [0] } }),
    ).toEqual([
      'action "jump" binds pad buttons but runtime.inputs has no "gamepad"',
      'action "left" binds pad buttons but runtime.inputs has no "gamepad"',
    ])
  })

  it('refuses touch declared with no touch binding and no gesture', () => {
    expect(inputsProblems(['touch', 'keyboard'], keyboardOnly)).toEqual([
      'runtime.inputs declares "touch" but no action binds a touch button or a gesture',
    ])
    expect(inputsProblems(['touch'], { swipe: { gesture: ['swipe-left'] } })).toEqual([])
  })

  it('lets gamepad stand without pad bindings: menus always read the pad', () => {
    expect(inputsProblems(['keyboard', 'gamepad'], keyboardOnly)).toEqual([])
  })
})
