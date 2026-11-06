import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import type { RunResult } from '#src/shared/node/process-runner.ts'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import {
  ITCH_FIRST_PUSH_CHECKLIST,
  type PublishItchInput,
  publishToItch,
} from '#src/shared/ship/targets/itch/publish-to-itch.ts'
import { fakeProcessRunner } from '#src/testing/fake-process-runner.ts'

const config: ShipConfig = defineShipConfig({
  game: { id: 'emberwick', title: 'Emberwick', version: '1.2.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  itch: { project: 'mcthaydt/emberwick' },
})

function dist(): string {
  const gameDir = mkdtempSync(join(tmpdir(), 'ship-publish-itch-'))
  const distDir = join(gameDir, 'dist')
  mkdirSync(distDir)
  writeFileSync(join(distDir, 'index.html'), '<p>hi</p>')
  return distDir
}

const input = (overrides: Partial<PublishItchInput> = {}): PublishItchInput => ({
  distDir: dist(),
  config,
  tag: 'v1.2.0',
  apiKey: 'secret-key',
  butlerPath: '/opt/butler/butler',
  ...overrides,
})

function publish(publishInput: PublishItchInput, reply: RunResult = { exitCode: 0, stdout: '', stderr: '' }) {
  const fake = fakeProcessRunner(() => reply)
  const result = Effect.runSync(Effect.either(Effect.provide(publishToItch(publishInput), fake.layer)))
  return { fake, result }
}

const leftOf = <A, E>(result: Either.Either<A, E>): E => {
  if (Either.isRight(result)) throw new Error('expected a failure')
  return result.left
}

describe('publishToItch', () => {
  it('prepares, then runs butler push with the exact arguments and the key only in the environment', () => {
    const publishInput = input()
    const { fake, result } = publish(publishInput)
    expect(Either.isRight(result)).toBe(true)
    expect(existsSync(join(publishInput.distDir, '..', 'emberwick-1.2.0-itch.zip'))).toBe(true)
    expect(fake.runs).toHaveLength(1)
    const [run] = fake.runs
    expect(run?.command).toBe('/opt/butler/butler')
    expect(run?.args).toEqual([
      'push',
      publishInput.distDir,
      'mcthaydt/emberwick:html5',
      '--userversion',
      '1.2.0',
      '--if-changed',
    ])
    expect(run?.options.env).toEqual({ BUTLER_API_KEY: 'secret-key' })
    expect(run?.options.echo).toBe(true)
    expect(run?.args.join(' ')).not.toContain('secret-key')
  })

  it('pushes to the configured channel', () => {
    const { fake } = publish(input({ config: { ...config, itch: { project: 'a/b', channel: 'web-beta' } } }))
    expect(fake.runs[0]?.args[2]).toBe('a/b:web-beta')
  })

  it('stops before any process when the itch section, the key or butler is missing, saying how to get it', () => {
    const cases: [Partial<PublishItchInput>, string, RegExp][] = [
      [{ config: { ...config, itch: undefined } }, 'itch', /itch: \{ project: 'user\/game' \}/],
      [
        { config: { ...config, itch: { project: 'McThaydt/Emberwick' } } },
        'itch',
        /itch\.project: must be the lower-case/,
      ],
      [{ apiKey: undefined }, 'BUTLER_API_KEY', /butler login.*butler_creds/s],
      [{ apiKey: '' }, 'BUTLER_API_KEY', /https:\/\/itch\.io\/docs\/butler\/login\.html/],
      [{ butlerPath: undefined }, 'butler', /https:\/\/itch\.io\/docs\/butler\/installing\.html/],
    ]
    for (const [overrides, setting, howTo] of cases) {
      const publishInput = input(overrides)
      const { fake, result } = publish(publishInput)
      const error = leftOf(result) as { _tag: string; setting: string; message: string }
      expect(error._tag, setting).toBe('ItchSettingMissing')
      expect(error.setting, setting).toBe(setting)
      expect(error.message, setting).toMatch(howTo)
      expect(fake.runs, setting).toHaveLength(0)
      expect(existsSync(join(publishInput.distDir, '..', 'emberwick-1.2.0-itch.zip')), setting).toBe(false)
    }
  })

  it('does not push a build that fails prepare', () => {
    const { fake, result } = publish(input({ tag: 'v9.9.9' }))
    expect(leftOf(result)._tag).toBe('VersionMismatch')
    expect(fake.runs).toHaveLength(0)
  })

  it("fails with butler's own exit code and does not retry", () => {
    const { fake, result } = publish(input(), { exitCode: 3, stdout: '', stderr: 'invalid api key\n' })
    const error = leftOf(result) as { _tag: string; exitCode: number }
    expect(error._tag).toBe('ButlerFailed')
    expect(error.exitCode).toBe(3)
    expect(fake.runs).toHaveLength(1)
  })

  it('reports a first push, with the first-push checklist, when butler says so', () => {
    const first = publish(input(), {
      exitCode: 0,
      stdout: '',
      stderr: '• For channel `html5`: pushing first build\n• Build is now processing\n',
    })
    expect(first.result).toEqual(Either.right({ firstPush: true }))
    const later = publish(input(), {
      exitCode: 0,
      stdout: '• For channel `html5`: last build is 41, downloading its signature\n',
      stderr: '',
    })
    expect(later.result).toEqual(Either.right({ firstPush: false }))
  })

  it('carries the spec §6 checklist', () => {
    for (const step of [
      'Kind of project',
      'This file will be played in the browser',
      'Embed in page',
      'Mobile friendly',
      'Fullscreen button',
      'Automatically start on page load',
    ]) {
      expect(ITCH_FIRST_PUSH_CHECKLIST).toContain(step)
    }
  })
})
