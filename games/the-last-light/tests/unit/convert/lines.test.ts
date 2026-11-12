import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { joinWords } from '../../../tools/convert/lines.ts'

const LINES = `[[lines]]
id = "prologue.monitor"
kind = "examine"
speaker = "ada"
text = "prologue.monitor"

[[lines]]
id = "prologue.clock"
kind = "examine"
text = "prologue.clock"
`
const LOCALE = `"prologue.monitor" = "The screen is dark. Nobody in 04 tonight. Good. Fine. Good."
"prologue.clock" = "Eight o’clock. Twelve hours."
`
const DELIVERY = {
  'prologue.monitor': {
    how: 'convincing herself',
    pace: 1.25,
    say: 'The screen is dark. Nobody in 04 tonight. Good. Fine.{.} Good.',
  },
}

function read(delivery: Parameters<typeof joinWords>[2] = DELIVERY) {
  const { files, report } = joinWords(LINES, LOCALE, delivery)
  const lines = (
    parse(files['content/lines/prologue.toml'] as string) as { lines: Record<string, unknown>[] }
  ).lines
  return { lines, report }
}

describe('joinWords', () => {
  it('gives each line the fixture’s words, byte for byte', () => {
    const { lines } = read()
    expect(lines.map((line) => line.words)).toEqual([
      'The screen is dark. Nobody in 04 tonight. Good. Fine. Good.',
      'Eight o’clock. Twelve hours.',
    ])
  })

  it('turns an old pause after a sentence into a beat after it, with the direction and pace', () => {
    const { lines } = read()
    expect(lines[0]?.delivery).toEqual({
      how: 'convincing herself',
      pace: 1.25,
      beats: [{ after: 4, pause: 1 }],
    })
    expect(lines[1]).not.toHaveProperty('delivery')
  })

  it('moves a pause inside a sentence to the sentence’s end, and says so', () => {
    const { lines, report } = read({ 'prologue.clock': { say: 'Eight o’clock{.} Twelve hours.' } })
    expect(lines[1]?.delivery).toEqual({ beats: [{ after: 1, pause: 1 }] })
    expect(report).toContainEqual(expect.objectContaining({ kind: 'delivery', did: 'approximated' }))
  })

  it('refuses a line whose words are missing, naming it', () => {
    expect(() => joinWords(LINES, '"prologue.monitor" = "x"\n', undefined)).toThrow(/prologue\.clock/)
  })
})
