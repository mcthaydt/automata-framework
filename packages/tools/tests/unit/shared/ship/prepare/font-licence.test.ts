import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { addFontLicence } from '#src/shared/ship/prepare/font-licence.ts'

const LICENCE = 'Copyright (c) 2023 Vercel\nSIL OPEN FONT LICENSE Version 1.1'

/** A game folder with a build, and (unless `installed` is false) the framework package with its licence file. */
function game(files: Record<string, string>, installed = true): { gameDir: string; distDir: string } {
  const gameDir = mkdtempSync(join(tmpdir(), 'font-licence-'))
  const distDir = join(gameDir, 'dist')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(distDir, path)), { recursive: true })
    writeFileSync(join(distDir, path), text)
  }
  if (installed) {
    const home = join(gameDir, 'node_modules/@automata/framework/licenses')
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, 'geist-OFL.txt'), LICENCE)
  }
  return { gameDir, distDir }
}

const run = (distDir: string, gameDir: string | undefined) =>
  Effect.runSync(Effect.either(addFontLicence(distDir, gameDir)))

describe('addFontLicence', () => {
  it('copies the full Geist licence into a build that carries the font', () => {
    const { gameDir, distDir } = game({ 'assets/latin.js': 'registers "af-hud-latin"' })
    expect(Either.isRight(run(distDir, gameDir))).toBe(true)
    expect(readFileSync(join(distDir, 'licenses/geist-OFL.txt'), 'utf8')).toBe(LICENCE)
  })

  it('writes nothing into a build that does not carry the font', () => {
    const { gameDir, distDir } = game({ 'assets/main.js': 'console.log("hi")' })
    expect(Either.isRight(run(distDir, gameDir))).toBe(true)
    expect(existsSync(join(distDir, 'licenses'))).toBe(false)
  })

  it('is the same on a second run', () => {
    const { gameDir, distDir } = game({ 'assets/latin.js': 'af-hud-cyrillic' })
    run(distDir, gameDir)
    expect(Either.isRight(run(distDir, gameDir))).toBe(true)
    expect(readFileSync(join(distDir, 'licenses/geist-OFL.txt'), 'utf8')).toBe(LICENCE)
  })

  it('stops, and says what to install, when the font is in the build but the licence cannot be found', () => {
    const { gameDir, distDir } = game({ 'assets/latin.js': 'af-hud-latin' }, false)
    const result = run(distDir, gameDir)
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect((result.left as { check?: string }).check).toBe('font-licence')
    expect(result.left.message).toContain('@automata/framework')
    expect(existsSync(join(distDir, 'licenses'))).toBe(false)
  })
})
