import { describe, expect, it } from 'vitest'
import { parseCliArgs } from './cli-args.ts'

describe('parseCliArgs', () => {
  it('reads prepare with an optional tag and build folder', () => {
    expect(parseCliArgs(['prepare'])).toEqual({ command: 'prepare', dist: 'dist', tag: undefined })
    expect(parseCliArgs(['prepare', '--tag', 'v0.1.0', '--dist', 'out'])).toEqual({
      command: 'prepare',
      dist: 'out',
      tag: 'v0.1.0',
    })
  })

  it('reads publish with --activate and --game', () => {
    expect(parseCliArgs(['publish', '--activate', '--game', 'g-abc'])).toEqual({
      command: 'publish',
      dist: 'dist',
      tag: undefined,
      activate: true,
      game: 'g-abc',
    })
  })

  it('reads deploy-dev with --activate', () => {
    expect(parseCliArgs(['deploy-dev', '--activate'])).toEqual({
      command: 'deploy-dev',
      dist: 'dist',
      tag: undefined,
      activate: true,
    })
  })

  it('passes everything after test-remote through untouched', () => {
    expect(
      parseCliArgs(['test-remote', 'games/placeholder/e2e/boot.e2e.ts', '--project=placeholder']),
    ).toEqual({
      command: 'test-remote',
      args: ['games/placeholder/e2e/boot.e2e.ts', '--project=placeholder'],
    })
  })

  it('answers usage for no command, an unknown command or an unknown flag', () => {
    expect(parseCliArgs([])).toEqual({ command: 'usage', problem: 'no command' })
    expect(parseCliArgs(['pack'])).toEqual({ command: 'usage', problem: 'unknown command: pack' })
    expect(parseCliArgs(['prepare', '--zip']).command).toBe('usage')
    expect(parseCliArgs(['prepare', '--activate']).command).toBe('usage')
  })

  it('reads --target itch on prepare and publish', () => {
    expect(parseCliArgs(['prepare', '--target', 'itch', '--tag', 'v1.2.0'])).toStrictEqual({
      command: 'prepare',
      dist: 'dist',
      tag: 'v1.2.0',
      target: 'itch',
    })
    expect(parseCliArgs(['publish', '--target=itch'])).toStrictEqual({
      command: 'publish',
      dist: 'dist',
      tag: undefined,
      activate: false,
      game: undefined,
      target: 'itch',
    })
  })

  it('reads --target ruken, and leaves target undefined without --target (the Ruken path)', () => {
    expect(parseCliArgs(['prepare', '--target', 'ruken'])).toMatchObject({
      command: 'prepare',
      target: 'ruken',
    })
    expect(parseCliArgs(['prepare'])).toStrictEqual({
      command: 'prepare',
      dist: 'dist',
      tag: undefined,
      target: undefined,
    })
    expect(parseCliArgs(['publish', '--activate'])).toMatchObject({
      command: 'publish',
      target: undefined,
      activate: true,
    })
  })

  it('answers usage for an unknown target, Ruken-only flags on itch, and a target on deploy-dev', () => {
    expect(parseCliArgs(['prepare', '--target', 'steam'])).toEqual({
      command: 'usage',
      problem: 'unknown target: steam (ruken or itch)',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--activate'])).toEqual({
      command: 'usage',
      problem: '--activate and --game are for publishing to Ruken, not itch.io',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--game', 'g-1']).command).toBe('usage')
    expect(parseCliArgs(['deploy-dev', '--target', 'itch']).command).toBe('usage')
  })
})
