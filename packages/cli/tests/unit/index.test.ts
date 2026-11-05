import { describe, expect, it } from 'vitest'
import * as Cli from './index.js'

describe('@mcthaydt/automata-cli', () => {
  it('exports createGame', () => {
    expect(Cli.createGame).toBeDefined()
  })

  it('exports automata check for the agent hooks and create-game', () => {
    expect(Cli.runCheck).toBeTypeOf('function')
    expect(Cli.CspProbeLive).toBeDefined()
    expect(Cli.toJson).toBeTypeOf('function')
  })
})
