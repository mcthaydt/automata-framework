import { compileHeaders } from '@ruken/manifest'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig } from '../../config/ship-config.ts'
import { checkManifest } from './check-manifest.ts'
import { rukenHeaders } from './ruken-headers.ts'
import { rukenToml } from './ruken-toml.ts'

const config = defineShipConfig({
  game: { id: 'headers-game', title: 'Headers', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

// DIST spec §5.1: a game's preview serves its build with the headers Ruken would, without the game importing
// `@ruken/manifest`; the Ruken target owns the call.
describe('rukenHeaders', () => {
  it("gives the headers Ruken serves the game's manifest with, framable by the given host origins", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    const hostOrigins = ['http://127.0.0.1:4600']
    expect(Effect.runSync(rukenHeaders(config, { hostOrigins }))).toEqual(
      compileHeaders(manifest, { hostOrigins }),
    )
  })

  it("gives Ruken's production headers for 'prod', with no eval in the CSP", () => {
    const headers = Effect.runSync(rukenHeaders(config, 'prod'))
    expect(headers['Content-Security-Policy']).toContain("script-src 'self'")
    expect(headers['Content-Security-Policy']).not.toMatch(/'unsafe-eval'/)
  })

  it('fails ManifestInvalid when Ruken refuses the config', () => {
    const { sdk: _sdk, ...game } = config.game
    const result = Effect.runSync(Effect.either(rukenHeaders({ ...config, game }, 'prod')))
    expect(Either.isLeft(result) && result.left._tag).toBe('ManifestInvalid')
  })
})
