import { describe, expect, it } from 'vitest'
import { openWebGames } from '#src/features/web-games/web-games.ts'
import { createFakeOpfs } from '#src/testing/kit/fake-fs.ts'

const decoder = new TextDecoder()

function browser() {
  const opfs = createFakeOpfs()
  let now = 1000
  return {
    storage: { getDirectory: () => Promise.resolve(opfs) },
    opfs,
    now: () => now,
    tick: (ms: number) => {
      now += ms
    },
  }
}

const FILES = [
  { path: 'content/editors.toml', text: 'format = "af-editors/1"\n' },
  { path: 'content/tuning.toml', text: '[player]\nspeed = 4\n' },
]

describe('the person’s games, kept in this browser', () => {
  it('creates a game: every file under its own folder, and a place in the list', async () => {
    const env = browser()
    const games = await openWebGames(env)
    const made = await games.create('Lantern Run', FILES)
    expect(made).toMatchObject({ id: 'lantern-run', title: 'Lantern Run', changed: 1000 })
    const store = await games.store('lantern-run')
    expect(decoder.decode(await store.read('content/tuning.toml'))).toBe('[player]\nspeed = 4\n')
    expect((await games.list()).map((game) => game.id)).toEqual(['lantern-run'])
    expect(games.kept).toBe(true)
  })

  it('gives a second game of the same name its own id', async () => {
    const games = await openWebGames(browser())
    await games.create('Lantern Run', FILES)
    expect((await games.create('Lantern Run', FILES)).id).toBe('lantern-run-2')
  })

  it('lists the newest change first, and touched moves a game up', async () => {
    const env = browser()
    const games = await openWebGames(env)
    await games.create('First', FILES)
    env.tick(10)
    await games.create('Second', FILES)
    expect((await games.list()).map((game) => game.id)).toEqual(['second', 'first'])
    env.tick(10)
    await games.touched('first')
    expect((await games.list()).map((game) => game.id)).toEqual(['first', 'second'])
  })

  it('keeps the list and the game opened last through a restart', async () => {
    const env = browser()
    const first = await openWebGames(env)
    await first.create('Lantern Run', FILES)
    await first.remember('lantern-run', 'writer')
    const again = await openWebGames(env)
    expect(await again.last()).toEqual({ game: 'lantern-run', editor: 'writer' })
    expect((await again.list()).map((game) => game.title)).toEqual(['Lantern Run'])
  })

  it('remembers which repository a game is kept on, and forgets it', async () => {
    const env = browser()
    const games = await openWebGames(env)
    await games.create('Lantern Run', FILES)
    await games.link('lantern-run', 'mcthaydt/lantern-run')
    expect((await (await openWebGames(env)).list())[0]?.github).toBe('mcthaydt/lantern-run')
    await games.link('lantern-run', undefined)
    expect((await games.list())[0]?.github).toBeUndefined()
  })

  it('removes a game: its folder and its place in the list, and last() no longer points at it', async () => {
    const env = browser()
    const games = await openWebGames(env)
    await games.create('Lantern Run', FILES)
    await games.remember('lantern-run')
    await games.remove('lantern-run')
    expect(await games.list()).toEqual([])
    expect(await games.last()).toBeUndefined()
    expect(await (await games.store('lantern-run')).list()).toEqual([])
  })

  it('makes the list again from the folders when games.json is damaged', async () => {
    const env = browser()
    const games = await openWebGames(env)
    await games.create('Lantern Run', FILES)
    const root = await env.opfs.getDirectoryHandle('games')
    const file = await root.getFileHandle('games.json', { create: true })
    const writable = await file.createWritable()
    await writable.write(new TextEncoder().encode('{ not json') as Uint8Array<ArrayBuffer>)
    await writable.close()
    const again = await openWebGames(env)
    expect((await again.list()).map((game) => game.id)).toEqual(['lantern-run'])
  })

  it('says why, and keeps games in memory only, when the browser has no private storage', async () => {
    const games = await openWebGames({ storage: {}, now: () => 1 })
    expect(games.kept).toBe(false)
    expect(games.reason).toMatch(/private file storage/i)
    await games.create('Lantern Run', FILES)
    expect((await games.list()).map((game) => game.id)).toEqual(['lantern-run'])
  })

  it('does not touch the sample game’s folder', async () => {
    const env = browser()
    const sample = await env.opfs.getDirectoryHandle('sample-game', { create: true })
    const handle = await sample.getFileHandle('keep.txt', { create: true })
    const writable = await handle.createWritable()
    await writable.write(new TextEncoder().encode('x') as Uint8Array<ArrayBuffer>)
    await writable.close()
    const games = await openWebGames(env)
    await games.create('Lantern Run', FILES)
    expect((await games.list()).map((game) => game.id)).toEqual(['lantern-run'])
    await sample.getFileHandle('keep.txt')
  })
})
