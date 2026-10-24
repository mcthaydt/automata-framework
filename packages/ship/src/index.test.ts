import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import * as ship from './index.ts'

describe('@mcthaydt/automata-ship', () => {
  it('names itself and runs on Effect', () => {
    expect(ship.SHIP_PACKAGE).toBe('@mcthaydt/automata-ship')
    expect(Effect.runSync(Effect.succeed(ship.SHIP_PACKAGE))).toBe('@mcthaydt/automata-ship')
  })

  it('exports the runtime.inputs check and its error (M4 spec §4.13)', () => {
    expect(typeof ship.inputsProblems).toBe('function')
    expect(typeof ship.ManifestInputsMismatch).toBe('function')
  })
})
