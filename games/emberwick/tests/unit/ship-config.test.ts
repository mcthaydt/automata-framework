import { checkManifest, inputsProblems, rukenToml, type ShipInputBindings } from '@automata/tools/internal'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { input } from '#src/app/game.ts'
import { GAME_ID } from '#src/shared/game-id.ts'
import packageJson from '../../package.json' with { type: 'json' }
import config from '../../ship.config.ts'

describe('emberwick ship.config.ts', () => {
  it("is a manifest Ruken's parser accepts, rendered with WebGL2", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.game.entry).toBe('index.html')
    expect(manifest.runtime.renderer).toBe('webgl2')
  })

  it('names the game the page tells the SDK, at the package version', () => {
    expect(config.game.id).toBe(GAME_ID)
    expect(config.game.version).toBe(packageJson.version)
  })

  it('is called Emberwick, by id and by title', () => {
    expect(config.game.id).toBe('emberwick')
    expect(config.game.title).toBe('Emberwick')
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

  it('ships the six default languages', () => {
    expect(config.content.languages).toEqual(['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
    expect(Effect.runSync(checkManifest(rukenToml(config))).content.languages).toEqual(
      config.content.languages,
    )
  })

  it('declares the fastest board the end screen submits to', () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.leaderboards?.fastest).toMatchObject({ order: 'asc', min: 1000, max: 3_600_000 })
  })

  it('carries the achievement in its manifest, as the rule Ruken awards', () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.achievements?.['ember-in-a-minute']).toEqual({
      title: 'Ember in a minute',
      description: 'Reach the ember in under 60 seconds.',
      board: 'fastest',
      reach: 60_000,
    })
  })
})
