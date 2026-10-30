import { defaultContent } from '@mcthaydt/automata'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { describe, expect, it } from 'vitest'
import { startAtPlay } from './start-at-play.ts'

const hashOf = (data: unknown) => hex64(xxhash64(utf8(canonicalJson(data))))

describe('startAtPlay', () => {
  it('moves the default flow to start at play, with the hash the runtime checks recomputed', () => {
    const content = defaultContent()
    const started = startAtPlay(content)
    expect(started.data.flow.entry).toBe('play')
    expect(started.hash).toBe(hashOf(started.data))
    expect({ ...started.data, flow: { ...started.data.flow, entry: 'title' } }).toEqual(content.data)
  })

  it("leaves a game's own flow alone when it has no title to play transition", () => {
    const content = defaultContent()
    const own = {
      data: { ...content.data, flow: { ...content.data.flow, entry: 'intro', transitions: [] } },
      hash: 'x',
    }
    expect(startAtPlay(own)).toBe(own)
  })
})
