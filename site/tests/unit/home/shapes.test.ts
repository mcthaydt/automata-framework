import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXAMPLE_EXCERPT, EXAMPLE_PATH } from '#src/features/home/home-content.ts'

// Home shows shapes-rects.ts and draws what it draws, so the three must name the same colours.
const repo = resolve(process.cwd(), '..')
const hexes = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => `#${match[1]!.toLowerCase()}`).sort()

describe("Home's shapes picture", () => {
  const source = readFileSync(resolve(repo, EXAMPLE_PATH), 'utf8')

  it("Home's code sample is shapes-rects.ts's view lines", () => {
    const view = source.slice(source.indexOf('views:'))
    for (const line of EXAMPLE_EXCERPT.split('\n').filter((each) => /color:/.test(each)))
      expect(view).toContain(line.trim())
  })

  it("ShapesPreview draws the same colours as the example's view", () => {
    const preview = readFileSync(resolve(process.cwd(), 'src/features/home/ShapesPreview.svelte'), 'utf8')
    const drawn = new Set(hexes(preview, /color: '#([0-9a-f]{6})'/gi))
    for (const colour of hexes(source, /color: 0x([0-9a-f]{6})/gi)) expect(drawn, colour).toContain(colour)
  })
})
