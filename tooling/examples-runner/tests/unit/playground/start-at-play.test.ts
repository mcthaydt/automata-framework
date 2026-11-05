import { contentHashOf, defaultContent } from '@mcthaydt/automata'
import { describe, expect, it } from 'vitest'
import { startAtPlay } from '#src/playground/start-at-play.ts'

describe('startAtPlay', () => {
  it('moves the default flow to start at play, with the hash the runtime checks recomputed', () => {
    const content = defaultContent()
    const started = startAtPlay({ content })
    expect(started.data.flow.entry).toBe('play')
    expect(started.hash).toBe(contentHashOf(started.data))
    expect({ ...started.data, flow: { ...started.data.flow, entry: 'title' } }).toEqual(content.data)
  })

  it("leaves a game's own flow alone when it has no title to play transition", () => {
    const content = defaultContent()
    const own = {
      data: { ...content.data, flow: { ...content.data.flow, entry: 'intro', transitions: [] } },
      hash: 'x',
    }
    expect(startAtPlay({ content: own })).toBe(own)
  })

  // The title is where a game with a save shows its slots (core-saves), so it keeps it.
  it('leaves a game with a save at its title', () => {
    const content = defaultContent()
    expect(startAtPlay({ content, saves: { def: { key: 'walk' } } })).toBe(content)
  })
})
