import { describe, expect, it } from 'vitest'
import { parseCliArgs } from '#src/cli-args.ts'

describe('parseCliArgs', () => {
  it('reads prepare with an optional tag and build folder', () => {
    expect(parseCliArgs(['prepare'])).toEqual({ command: 'prepare', dist: 'dist', tag: undefined })
    expect(parseCliArgs(['prepare', '--tag', 'v0.1.0', '--dist', 'out'])).toEqual({
      command: 'prepare',
      dist: 'out',
      tag: 'v0.1.0',
    })
  })

  // Review of #241: a private prepare followed by a raw `ruken publish` was a public upload with the guard off. The
  // private path is `publish --private`, which ship refuses unless RUKEN_API is Ruken's local stack.
  it('reads publish --private for Ruken’s local stack, and refuses prepare --private and itch.io', () => {
    expect(parseCliArgs(['publish', '--private'])).toStrictEqual({
      command: 'publish',
      dist: 'dist',
      tag: undefined,
      activate: false,
      game: undefined,
      target: undefined,
      private: true,
    })
    expect(parseCliArgs(['prepare', '--private']).command).toBe('usage')
    expect(parseCliArgs(['publish', '--private', '--target', 'itch']).command).toBe('usage')
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
      parseCliArgs([
        'test-remote',
        'games/emberwick/e2e/base-2d.e2e.ts',
        '--project=emberwick-phone-chromium',
      ]),
    ).toEqual({
      command: 'test-remote',
      args: ['games/emberwick/e2e/base-2d.e2e.ts', '--project=emberwick-phone-chromium'],
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

  // DIST spec §6.2: the desktop target builds bundles with `prepare`; it has no publish of its own (5c pushes them to
  // itch.io).
  // DIST spec §6.4: the desktop bundles are pushed to itch.io's Downloadable channels.
  it('reads --from tauri on publish --target itch, and refuses it anywhere else', () => {
    expect(parseCliArgs(['publish', '--target', 'itch', '--from', 'tauri'])).toMatchObject({
      command: 'publish',
      target: 'itch',
      from: 'tauri',
    })
    expect(parseCliArgs(['publish', '--from', 'tauri'])).toEqual({
      command: 'usage',
      problem: '--from tauri pushes desktop bundles to itch.io: use it with --target itch',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--from', 'web']).command).toBe('usage')
  })

  it('reads --target tauri on prepare, and refuses it on publish', () => {
    expect(parseCliArgs(['prepare', '--target', 'tauri'])).toStrictEqual({
      command: 'prepare',
      dist: 'dist',
      tag: undefined,
      target: 'tauri',
    })
    expect(parseCliArgs(['publish', '--target', 'tauri'])).toEqual({
      command: 'usage',
      problem: 'publish has no tauri target: prepare --target tauri builds the desktop bundles',
    })
  })

  it('answers usage for an unknown target, Ruken-only flags on itch, and a target on deploy-dev', () => {
    expect(parseCliArgs(['prepare', '--target', 'steam'])).toEqual({
      command: 'usage',
      problem: 'unknown target: steam (ruken, itch or tauri)',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--activate'])).toEqual({
      command: 'usage',
      problem: '--activate and --game are for publishing to Ruken, not itch.io',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--game', 'g-1']).command).toBe('usage')
    expect(parseCliArgs(['deploy-dev', '--target', 'itch']).command).toBe('usage')
  })
})
