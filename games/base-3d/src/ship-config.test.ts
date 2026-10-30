import { checkManifest, inputsProblems, rukenToml, type ShipInputBindings } from '@mcthaydt/automata-ship'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { base3d, input } from '../game.ts'
import packageJson from '../package.json' with { type: 'json' }
import config from '../ship.config.ts'

describe('base-3d ship.config.ts', () => {
  it("is a manifest Ruken's parser accepts, rendered with WebGL2, landscape (M3 spec §4.7)", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.game.entry).toBe('index.html')
    expect(manifest.runtime.renderer).toBe('webgl2')
    expect(manifest.runtime.orientation).toBe('landscape')
  })

  it('names the game the page boots, at the package version, in the same orientation', () => {
    expect(config.game.id).toBe(base3d.id)
    expect(config.game.version).toBe(packageJson.version)
    expect(base3d.orientation).toBe('landscape')
  })

  it('asks for no network and no eval', () => {
    expect(config.network.connect).toEqual([])
    expect(rukenToml(config)).toContain('allow_eval = false')
  })

  // M4 spec §4.13 (I-g): the manifest declares every device the input map binds.
  it('declares runtime.inputs that agree with the input map', () => {
    const bindings: ShipInputBindings = input.profile.bindings
    expect(inputsProblems(config.runtime.inputs, bindings)).toEqual([])
  })
})
