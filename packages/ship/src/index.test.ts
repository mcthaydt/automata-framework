import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { SHIP_PACKAGE } from './index.ts'

describe('@mcthaydt/automata-ship', () => {
  it('names itself and runs on Effect', () => {
    expect(SHIP_PACKAGE).toBe('@mcthaydt/automata-ship')
    expect(Effect.runSync(Effect.succeed(SHIP_PACKAGE))).toBe('@mcthaydt/automata-ship')
  })
})
