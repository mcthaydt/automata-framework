import { templateFiles } from '@mcthaydt/automata-tools/template-files'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '#src/features/app-store/app-store.ts'
import { compileGame } from '#src/features/player/compile-game.ts'
import { fakeAppFs } from '../app-store/fake-app-fs.ts'
import { fakeRuntime } from './fake-games.ts'

// The whole path a person takes on a phone, against the app's real store code and the real compile: make a game,
// change something in it, close the app, open it again, play, and see the change. Only the folder (Tauri's file
// plugin) and the runtime bundles are fakes.

const decoder = new TextDecoder()

describe('make a game, edit it, restart, play', () => {
  it('shows the change after the app is closed and opened again', async () => {
    const fs = fakeAppFs()
    const root = '/Games/lantern-run'
    const made = createAppStore(fs, root)
    for (const file of templateFiles({ id: 'lantern-run', title: 'Lantern Run', frameworkVersion: '0.1.0' }))
      expect((await made.write(file.path, file.text)).ok).toBe(true)

    const before = await compileGame(made, fakeRuntime())
    if ('reason' in before) throw new Error(before.message)
    const contentBefore = String(before.files.get('__automata__/content.js'))

    // The person moves the player's start across the room, in the level's file.
    const level = decoder.decode(await made.read('content/levels/start.toml'))
    expect(level).toContain('x = 48')
    expect((await made.write('content/levels/start.toml', level.replace('x = 48', 'x = 200'))).ok).toBe(true)

    // The app is swiped away; a new store over the same folder is what the next start reads.
    const reopened = createAppStore(fs, root)
    expect(decoder.decode(await reopened.read('content/levels/start.toml'))).toContain('x = 200')

    const after = await compileGame(reopened, fakeRuntime())
    if ('reason' in after) throw new Error(after.message)
    const contentAfter = String(after.files.get('__automata__/content.js'))
    expect(contentAfter).not.toBe(contentBefore)
    expect(contentAfter).toContain('200')
    // The game the person plays is the one they edited, and nothing of the compile is left in the game's own folder.
    expect((await reopened.list('')).some((entry) => entry.path.startsWith('__automata__'))).toBe(false)
  })
})
