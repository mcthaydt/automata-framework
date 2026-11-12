import { content } from 'virtual:automata/content'
import { describe, expect, it } from 'vitest'
import { playOf } from '#src/app/content.ts'

// Every file the game keeps under content/ is compiled by a kind the content plugin was told about. A file of a kind nobody
// registered is skipped without a word, so the numbers a person edits would never reach the game; this holds each one.

const kinds = content as unknown as Record<string, Record<string, unknown> | undefined>

describe('the content the game compiles', () => {
  it('has a kind for each of the game’s own files', () => {
    for (const kind of ['audio', 'hud', 'peek', 'carried-light'])
      expect(kinds[kind], `no ${kind} in the compiled content`).toBeDefined()
  })

  it('gives the sim the hand lamp’s and the peek’s numbers from their files', () => {
    const play = playOf(content)
    expect(play.lamp.radius).toBe(2.2)
    expect(play.peek).toEqual({ reach: 1.4, dwell: 0.6, arc: 50, lean: 1.2, ease: 0.4 })
  })
})
