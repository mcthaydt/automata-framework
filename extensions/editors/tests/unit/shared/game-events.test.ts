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

// A story game (the `--story` template) has conversations, cutscenes and characters beside its own events. Feel's
// "When …" and Audio's "When … happens" both pick from this list, so the person finds a conversation's line without
// knowing an event id, and no extension's package.json carries a second list of them.
describe('gameEvents of a story game', () => {
  it('lists what the conversations, cutscenes and characters say, in words, beside the game’s own event', async () => {
    const events = await gameEvents(
      await workspaceOf({
        'content/generated/events.json': JSON.stringify(['square.bumped']),
        'content/dialogue/intro.toml': 'id = "intro"\n',
        'content/cutscenes/opening.toml': 'id = "opening"\nduration = 5\n',
        'content/systems/guard.toml': 'id = "guard"\n',
      }),
    )
    const words = new Map(events.map((event) => [event.id, event.words]))
    expect(words.get('square.bumped')).toBe('square bumped')
    expect(words.get('narrative.line')).toBe('a conversation shows a line')
    expect(words.get('cutscene.started')).toBe('a cutscene starts')
    expect(words.get('systems.caught')).toBe('a character catches the player')
  })

  it('lists none of an extension’s events for a game that has none of its content', async () => {
    const events = await gameEvents(
      await workspaceOf({ 'content/generated/events.json': JSON.stringify(['square.bumped']) }),
    )
    expect(events.map((event) => event.id)).toEqual(['square.bumped'])
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
