import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Exit } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CreateGameError, createGame } from './create-game.ts'

describe('createGame', () => {
  const testDir = join(process.cwd(), 'scratch-test-game')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('id validation', () => {
    it.each(['MyGame', 'my game', 'my_game', 'my.game', 'game!', '', '-start-hyphen', 'end-hyphen-'])(
      'rejects invalid id: "%s"',
      async (invalidId) => {
        const exit = await Effect.runPromise(
          Effect.exit(
            createGame({
              targetDir: testDir,
              id: invalidId,
              title: 'Test Game',
            }),
          ),
        )

        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          if (exit.cause._tag === 'Fail') {
            const err = exit.cause.error
            expect(err).toBeInstanceOf(CreateGameError)
            expect(err.reason).toBe('invalid-id')
          } else {
            expect.unreachable('expected Fail cause')
          }
        }
      },
    )
  })

  describe('directory collision', () => {
    it('fails when target directory exists and is not empty', async () => {
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'existing.txt'), 'hello')

      const exit = await Effect.runPromise(
        Effect.exit(
          createGame({
            targetDir: testDir,
            id: 'test-game',
            title: 'Test Game',
          }),
        ),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        if (exit.cause._tag === 'Fail') {
          const err = exit.cause.error
          expect(err).toBeInstanceOf(CreateGameError)
          expect(err.reason).toBe('target-directory-exists')
        } else {
          expect.unreachable('expected Fail cause')
        }
      }
    })
  })

  describe('scaffolding', () => {
    it('creates all project template files and substitutes id and title', async () => {
      const result = await Effect.runPromise(
        createGame({
          targetDir: testDir,
          id: 'stellar-odyssey',
          title: 'Stellar Odyssey',
        }),
      )

      expect(result.id).toBe('stellar-odyssey')
      expect(result.title).toBe('Stellar Odyssey')
      expect(result.targetDir).toBe(testDir)
      expect(result.createdFiles.length).toBeGreaterThanOrEqual(10)

      // Verify files exist
      expect(existsSync(join(testDir, 'package.json'))).toBe(true)
      expect(existsSync(join(testDir, 'ship.config.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'vite.config.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true)
      expect(existsSync(join(testDir, 'index.html'))).toBe(true)
      expect(existsSync(join(testDir, 'style.css'))).toBe(true)
      expect(existsSync(join(testDir, 'src/main.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'src/boot.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'src/game.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'src/sim/sim.ts'))).toBe(true)
      expect(existsSync(join(testDir, 'src/sim/index.ts'))).toBe(true)

      // Verify template substitutions
      const pkgJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8'))
      expect(pkgJson.name).toBe('stellar-odyssey')

      const shipConfig = readFileSync(join(testDir, 'ship.config.ts'), 'utf8')
      expect(shipConfig).toContain("id: 'stellar-odyssey'")
      expect(shipConfig).toContain("title: 'Stellar Odyssey'")

      const indexHtml = readFileSync(join(testDir, 'index.html'), 'utf8')
      expect(indexHtml).toContain('<title>Stellar Odyssey</title>')

      // Every asset ships as a file: an inlined `data:` URL is refused by Ruken's CSP when fetched (DX.5a).
      const viteConfig = readFileSync(join(testDir, 'vite.config.ts'), 'utf8')
      expect(viteConfig).toContain('assetsInlineLimit: 0')
    })

    // A new game installs the versions AF is tested on, so every exact pin the scaffold writes must be a row of
    // docs/versions.md; a bump that moves the doc and the workspace but not the scaffold fails here.
    it('pins every exact dependency at a version recorded in docs/versions.md', async () => {
      await Effect.runPromise(createGame({ targetDir: testDir, id: 'pinned-game', title: 'Pinned Game' }))

      const versionsDoc = readFileSync(new URL('../../../docs/versions.md', import.meta.url), 'utf8')
      const recorded = new Set(
        [...versionsDoc.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([^|\s]+)\s*\|/gm)].map(
          (row) => `${row[1]}@${row[2]}`,
        ),
      )
      const pkgJson = JSON.parse(readFileSync(join(testDir, 'package.json'), 'utf8'))
      const exactPins = Object.entries<string>({ ...pkgJson.dependencies, ...pkgJson.devDependencies })
        .filter(([, version]) => /^\d+\.\d+\.\d+$/.test(version))
        .map(([name, version]) => `${name}@${version}`)

      expect(exactPins).toContain(`pixi.js@${pkgJson.dependencies['pixi.js']}`)
      expect(exactPins.filter((pin) => !recorded.has(pin))).toEqual([])
    })
  })
})
