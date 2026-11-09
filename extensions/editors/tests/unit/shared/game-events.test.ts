import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { audioFileWith, gameEvents } from '#src/shared/game-events.ts'

async function workspaceOf(files: Record<string, string>) {
  const { ports } = await createMemoryPorts({
    files,
    generated: (path) => path.startsWith('content/generated/'),
    classify: (path) => ({ path, editor: 'feel', gates: [], checks: [], modes: ['edit'], writable: true }),
  })
  return ports.workspace
}

describe('gameEvents', () => {
  it('gives the game’s own list and what its files already answer, each id once, sorted', async () => {
    const workspace = await workspaceOf({
      'content/feel/feel.toml': '[[entry]]\non = "player.hit"\n[[entry]]\non = "door.*"\n',
      'content/audio/audio.toml': '[[event]]\non = "player.hit"\ncue = "thud"\n',
      'content/generated/events.json': JSON.stringify([{ id: 'player.jumped' }, 'player.hit']),
    })
    const events = await gameEvents(workspace)
    expect(events.map((event) => event.id)).toEqual(['door.*', 'player.hit', 'player.jumped'])
    expect(events.find((event) => event.id === 'player.hit')).toEqual({
      id: 'player.hit',
      words: 'player hit',
      from: 'The game’s events',
      noSubject: false,
    })
  })

  it('skips a file that does not parse, and gives none for a game with nothing', async () => {
    const workspace = await workspaceOf({
      'content/audio/audio.toml': 'event = [',
      'content/feel/feel.toml': '[[entry]]\non = "enemy.died"\n',
    })
    expect((await gameEvents(workspace)).map((event) => event.id)).toEqual(['enemy.died'])
    expect(await gameEvents(await workspaceOf({}))).toEqual([])
  })

  it('adds an extension’s events when the game has its content, read from its own definitions', async () => {
    const workspace = await workspaceOf({
      'content/cutscenes/opening.toml': 'id = "opening"\nduration = 5\n',
    })
    const events = await gameEvents(workspace)
    expect(events.map((event) => event.id)).toEqual(['cutscene.ended', 'cutscene.started'])
    expect(events[0]?.from).toBe('Cutscenes')
    // A cutscene starting happens to no one in particular, so a freeze on it has nothing to hold.
    expect(events.every((event) => event.noSubject)).toBe(true)
    const own = await gameEvents(
      await workspaceOf({ 'content/generated/events.json': JSON.stringify(['player.hit']) }),
    )
    expect(own[0]?.noSubject).toBe(false)
  })
})

describe('audioFileWith', () => {
  it('gives the audio file that has the sound, to play it as the game would', async () => {
    const workspace = await workspaceOf({
      'content/audio/audio.toml': '[[cue]]\nid = "hit"\n',
      'content/audio/more.toml': '[[cue]]\nid = "coin"\n',
    })
    expect(await audioFileWith(workspace, 'coin')).toMatchObject({ cue: [{ id: 'coin' }] })
    expect(await audioFileWith(workspace, 'nope')).toBeUndefined()
  })
})
