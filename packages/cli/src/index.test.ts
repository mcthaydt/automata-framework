import { describe, expect, it } from 'vitest'
import * as Cli from './index.js'

describe('@mcthaydt/automata-cli', () => {
  it('exports createGame', () => {
    expect(Cli.createGame).toBeDefined()
  })
})
