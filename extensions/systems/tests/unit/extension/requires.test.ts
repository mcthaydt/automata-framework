import { defineGame } from '@automata/framework'
import { puzzleExtension } from '@automata/puzzle'
import { sectorsExtension } from '@automata/sectors'
import { definePlugin } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { systemsExtension } from '#src/entries/index.ts'

// `systems` needs `sectors`, `nav` and `puzzle`. A game that lists it without `nav` is refused at `defineGame`, and the
// refusal names who needs what, so the author knows which extension to add.

const spec = {
  id: 'ward',
  size: { width: 320, height: 180 },
  sim: { plugins: [definePlugin({ name: 'ward', defs: [] })] },
}

describe('systems requires sectors, nav and puzzle', () => {
  it('is refused without nav, and the error names both who asks and what is missing', () => {
    const extensions = [
      systemsExtension().extension,
      sectorsExtension,
      puzzleExtension({ extensions: ['systems'] }),
    ]
    let thrown: unknown
    try {
      defineGame({ ...spec, extensions })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({
      name: 'ExtensionError',
      reason: 'missing',
      names: ['systems', 'nav'],
      message: 'missing: systems, nav',
    })
  })
})
