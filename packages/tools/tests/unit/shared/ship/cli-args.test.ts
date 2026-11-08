import { describe, expect, it } from 'vitest'
import { parseCliArgs } from '#src/shared/ship/cli-args.ts'

describe('parseCliArgs', () => {
  it('reads prepare with a target, an optional tag and a build folder', () => {
    expect(parseCliArgs(['prepare', '--target', 'ruken'])).toEqual({
      command: 'prepare',
      dist: 'dist',
      tag: undefined,
      target: 'ruken',
    })
    expect(parseCliArgs(['prepare', '--target', 'web', '--tag', 'v0.1.0', '--dist', 'out'])).toEqual({
      command: 'prepare',
      dist: 'out',
      tag: 'v0.1.0',
      target: 'web',
    })
  })

  // U5: no target is the default, so a script never ships to Ruken because it forgot a flag.
  it('asks for a target every time, and names the choices', () => {
    expect(parseCliArgs(['prepare'])).toEqual({
      command: 'usage',
      problem: 'Choose a target: --target web, itch, tauri or ruken.',
    })
    expect(parseCliArgs(['publish', '--tag', 'v1.0.0'])).toEqual({
      command: 'usage',
      problem: 'Choose a target: --target itch or ruken.',
    })
  })

  // Review of #241: a private prepare followed by a raw `ruken publish` was a public upload with the guard off. The
  // private path is `publish --private`, which ship refuses unless RUKEN_API is Ruken's local stack.
  it('reads publish --private for Ruken’s local stack, and refuses prepare --private and itch.io', () => {
    expect(parseCliArgs(['publish', '--target', 'ruken', '--private'])).toStrictEqual({
      command: 'publish',
      dist: 'dist',
      tag: undefined,
      activate: false,
      game: undefined,
      target: 'ruken',
      private: true,
    })
    expect(parseCliArgs(['prepare', '--target', 'ruken', '--private']).command).toBe('usage')
    expect(parseCliArgs(['publish', '--private', '--target', 'itch']).command).toBe('usage')
  })

  it('reads publish with --activate and --game', () => {
    expect(parseCliArgs(['publish', '--target', 'ruken', '--activate', '--game', 'g-abc'])).toEqual({
      command: 'publish',
      dist: 'dist',
      tag: undefined,
      activate: true,
      game: 'g-abc',
      target: 'ruken',
    })
  })

  it('answers help for --help, -h and help, so a developer asking for help gets the usage and no error', () => {
    for (const word of ['--help', '-h', 'help']) {
      expect(parseCliArgs([word])).toEqual({ command: 'help' })
    }
  })

  it('answers usage for no command, an unknown command or an unknown flag', () => {
    expect(parseCliArgs([])).toEqual({ command: 'usage', problem: 'no command' })
    expect(parseCliArgs(['pack'])).toEqual({ command: 'usage', problem: 'unknown command: pack' })
    expect(parseCliArgs(['prepare', '--target', 'web', '--zip']).command).toBe('usage')
    expect(parseCliArgs(['prepare', '--target', 'web', '--activate']).command).toBe('usage')
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

  it('reads --target ruken and --target web on prepare', () => {
    expect(parseCliArgs(['prepare', '--target', 'ruken'])).toMatchObject({
      command: 'prepare',
      target: 'ruken',
    })
    expect(parseCliArgs(['prepare', '--target', 'web'])).toMatchObject({ command: 'prepare', target: 'web' })
    expect(parseCliArgs(['publish', '--target', 'ruken', '--activate'])).toMatchObject({
      command: 'publish',
      target: 'ruken',
      activate: true,
    })
  })

  it('has nothing to publish for web: the folder goes on any static host', () => {
    expect(parseCliArgs(['publish', '--target', 'web'])).toEqual({
      command: 'usage',
      problem:
        'There is nothing to publish for web. After prepare --target web, upload the dist folder to any static host.',
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
    expect(parseCliArgs(['publish', '--target', 'ruken', '--from', 'tauri'])).toEqual({
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

  it('answers usage for an unknown target, and Ruken-only flags on itch', () => {
    expect(parseCliArgs(['prepare', '--target', 'steam'])).toEqual({
      command: 'usage',
      problem: 'unknown target: steam (web, itch, tauri or ruken)',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--activate'])).toEqual({
      command: 'usage',
      problem: '--activate and --game are for publishing to Ruken, not itch.io',
    })
    expect(parseCliArgs(['publish', '--target', 'itch', '--game', 'g-1']).command).toBe('usage')
  })
})
