import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig } from '../config/ship-config.ts'
import { checkManifest } from './check-manifest.ts'
import { rukenToml } from './ruken-toml.ts'

const config = defineShipConfig({
  game: { id: 'placeholder', title: 'Placeholder', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

describe('checkManifest', () => {
  it("returns Ruken's parsed manifest for a valid file", () => {
    const manifest = Effect.runSync(checkManifest(rukenToml(config)))
    expect(manifest.game.id).toBe('placeholder')
  })

  it('fails with ManifestInvalid naming each problem and its field', () => {
    const toml = rukenToml({
      ...config,
      network: { connect: ['http://localhost:3000'] },
      content: { ...config.content, languages: ['fr'] },
    })
    const result = Effect.runSync(Effect.either(checkManifest(toml)))
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('ManifestInvalid')
    const codes = result.left.problems.map((problem) => problem.code)
    expect(codes).toContain('LANGUAGES_MISSING_EN')
    expect(codes.some((code) => code.startsWith('CONNECT_'))).toBe(true)
    expect(result.left.problems.every((problem) => problem.path.length > 0)).toBe(true)
    expect(result.left.message).toContain('content.languages')
  })
})
