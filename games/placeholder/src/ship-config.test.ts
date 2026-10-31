import { checkManifest, rukenToml } from '@mcthaydt/automata-ship'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import packageJson from '../package.json' with { type: 'json' }
import config from '../ship.config.ts'
import { GAME_ID } from './ruken/boot.ts'

describe('placeholder ship.config.ts', () => {
  it("is a manifest Ruken's parser accepts", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.game.entry).toBe('index.html')
  })

  it('names the game the page tells the SDK, at the package version', () => {
    expect(config.game.id).toBe(GAME_ID)
    expect(config.game.version).toBe(packageJson.version)
  })

  it('asks for no network and no eval: the page only talks to its host', () => {
    expect(config.network.connect).toEqual([])
    expect(rukenToml(config)).toContain('allow_eval = false')
  })
})
