import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const fonts = readFileSync(new URL('../../../../src/shared/kit/fonts.css', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('../../../../src/shared/kit/tokens.css', import.meta.url), 'utf8')

describe('fonts.css', () => {
  test('loads Geist and Geist Mono, the website`s faces, from the package, never another origin', () => {
    expect(fonts).toContain('@import "@fontsource-variable/geist/wght.css";')
    expect(fonts).toContain('@import "@fontsource-variable/geist-mono/wght.css";')
    expect(fonts).not.toMatch(/https?:\/\//)
    expect(fonts).not.toMatch(/plex/i)
  })

  test('the tokens name the same families', () => {
    expect(tokens).toMatch(/--font-sans: "Geist Variable",/)
    expect(tokens).toMatch(/--font-mono:\s*"Geist Mono Variable",/)
  })
})
