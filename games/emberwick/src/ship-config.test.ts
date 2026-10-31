import { checkManifest, inputsProblems, rukenToml, type ShipInputBindings } from '@mcthaydt/automata-ship'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json' with { type: 'json' }
import config from '../ship.config.ts'
import { input } from './game.ts'
import { GAME_ID } from './ruken/boot.ts'

describe('base-2d ship.config.ts', () => {
  it("is a manifest Ruken's parser accepts, rendered with WebGL2", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.game.entry).toBe('index.html')
    expect(manifest.runtime.renderer).toBe('webgl2')
  })

  it('names the game the page tells the SDK, at the package version', () => {
    expect(config.game.id).toBe(GAME_ID)
    expect(config.game.version).toBe(packageJson.version)
  })

  it('asks for no network and no eval', () => {
    expect(config.network.connect).toEqual([])
    expect(rukenToml(config)).toContain('allow_eval = false')
  })

  // M4 spec §4.13 (I-g): the manifest declares every device the input map binds, and touch only with touch buttons.
  // The assignment also proves an input profile's bindings are what ship reads.
  it('declares runtime.inputs that agree with the input map', () => {
    const bindings: ShipInputBindings = input.profile.bindings
    expect(inputsProblems(config.runtime.inputs, bindings)).toEqual([])
  })
})
