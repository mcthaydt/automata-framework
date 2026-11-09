import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { openCopy, saveCopy } from '#src/features/web-games/game-copy.ts'
import { openWebGames } from '#src/features/web-games/web-games.ts'
import { createFakeOpfs } from '#src/testing/kit/fake-fs.ts'

const decoder = new TextDecoder()
const LIST = 'format = "af-editors/1"\n'
const NOT_A_GAME = 'This isn’t an Automata game. Pick a .zip you saved from Automata.'

async function browser() {
  const opfs = createFakeOpfs()
  return openWebGames({ storage: { getDirectory: () => Promise.resolve(opfs) }, now: () => 1 })
}

async function made() {
  const games = await browser()
  const entry = await games.create('Lantern Run', [
    { path: 'content/editors.toml', text: LIST },
    { path: 'content/tuning.toml', text: '[player]\nspeed = 4\n' },
    { path: 'content/pic.bin', bytes: new Uint8Array([0, 255, 7]) },
  ])
  const store = await games.store(entry.id)
  await store.write('.automata/sync.json', '{}')
  return { games, store }
}

describe('Save a copy and Open a copy', () => {
  it('gives the same files back, and leaves the sync notes behind', async () => {
    const { store } = await made()
    const zip = await saveCopy(store)
    const other = await browser()
    const opened = await openCopy(zip, other, 'Lantern Run')
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const back = await other.store(opened.game.id)
    expect((await back.list()).map((entry) => entry.path)).toEqual([
      'content/editors.toml',
      'content/pic.bin',
      'content/tuning.toml',
    ])
    expect([...((await back.read('content/pic.bin')) ?? [])]).toEqual([0, 255, 7])
    expect(decoder.decode(await back.read('content/tuning.toml'))).toBe('[player]\nspeed = 4\n')
    expect(opened.game.title).toBe('Lantern Run')
  })

  it('reads a zip whose files all sit in one folder as if they were at the top', async () => {
    const zip = zipSync({
      'my-game/content/editors.toml': strToU8(LIST),
      'my-game/content/a.toml': strToU8('a = 1'),
    })
    const games = await browser()
    const opened = await openCopy(zip, games)
    expect(opened).toMatchObject({ ok: true, game: { title: 'my-game' } })
  })

  it('refuses a zip with no editor list, in words', async () => {
    const games = await browser()
    expect(await openCopy(zipSync({ 'readme.txt': strToU8('hi') }), games)).toEqual({
      ok: false,
      why: NOT_A_GAME,
    })
    expect(await openCopy(strToU8('not a zip at all'), games)).toEqual({ ok: false, why: NOT_A_GAME })
  })

  it('refuses a path that climbs out of the game, and a file over 16 MB', async () => {
    const games = await browser()
    const climbing = zipSync({ 'content/editors.toml': strToU8(LIST), '../outside.txt': strToU8('x') })
    expect(await openCopy(climbing, games)).toMatchObject({ ok: false })
    const big = zipSync({
      'content/editors.toml': strToU8(LIST),
      'content/big.bin': new Uint8Array(16 * 1024 * 1024 + 1),
    })
    expect(await openCopy(big, games)).toMatchObject({ ok: false, why: expect.stringContaining('too big') })
    expect(await games.list()).toEqual([])
  })
})
