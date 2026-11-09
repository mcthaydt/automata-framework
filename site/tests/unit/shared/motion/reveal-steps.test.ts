import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Home from '#src/features/home/Home.svelte'
import { isBelowWindow, REVEAL_SECTIONS, revealSteps } from '#src/shared/motion/reveal-steps.ts'

function sections(): Element[] {
  const view = render(Home)
  return [...view.container.querySelectorAll('.home-section')]
}

describe('revealSteps', () => {
  it('finds sections on Home, whatever their number', () => {
    expect(REVEAL_SECTIONS).toBe('main .home-section')
    expect(sections().length).toBeGreaterThan(0)
  })

  it('lists words first, then products, then list items, each once', () => {
    for (const section of sections()) {
      const parts = revealSteps(section)
      expect(parts.length, section.className).toBeGreaterThan(0)
      const elements = parts.map((part) => part.element)
      expect(new Set(elements).size).toBe(elements.length)
      // The order is words, then products, then items: a product never comes before a word.
      const flags = parts.map((part) => (part.product ? 1 : 0))
      const firstProduct = flags.indexOf(1)
      if (firstProduct >= 0) {
        const wordsAfter = elements
          .slice(firstProduct)
          .some((el) => el.matches('.home-kicker, h2, .home-sub'))
        expect(wordsAfter).toBe(false)
      }
      for (const part of parts) {
        expect(part.product).toBe(part.element.matches('.show, .home-panel'))
      }
    }
  })

  it('never returns a part that contains another part, or sits outside a section', () => {
    for (const section of sections()) {
      const elements = revealSteps(section).map((part) => part.element)
      for (const a of elements) {
        expect(a.closest('.home-section')).toBe(section)
        for (const b of elements)
          if (a !== b) expect(a.contains(b), `${a.className} contains ${b.className}`).toBe(false)
      }
    }
  })

  it('puts the section’s words in document order at the front', () => {
    const [first] = sections()
    const words = revealSteps(first as Element)
      .filter((part) => !part.product)
      .map((part) => part.element)
    expect(words[0]?.matches('.home-kicker')).toBe(true)
  })

  it('never reaches the hero, the facts, the logo strip or the closing band', () => {
    const view = render(Home)
    const all = new Set<Element>()
    for (const section of view.container.querySelectorAll('.home-section')) {
      for (const part of revealSteps(section)) all.add(part.element)
    }
    for (const outside of view.container.querySelectorAll('.hero *, .facts *, .made *, .close *')) {
      expect(all.has(outside), outside.className).toBe(false)
    }
  })

  it('is not used by any reading page', () => {
    const features = ['docs', 'api', 'changelog', 'start', 'legal', 'examples', 'playground']
    const walk = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name)
        return statSync(path).isDirectory() ? walk(path) : [path]
      })
    for (const feature of features) {
      for (const file of walk(resolve(process.cwd(), 'src/features', feature))) {
        expect(readFileSync(file, 'utf8'), file).not.toContain('home-section')
      }
    }
  })
})

describe('isBelowWindow', () => {
  const at = (top: number) => ({ getBoundingClientRect: () => ({ top }) }) as unknown as Element
  it('is true when the top is at or below the window’s bottom edge', () => {
    expect(isBelowWindow(at(900), 800)).toBe(true)
    expect(isBelowWindow(at(800), 800)).toBe(true)
  })
  it('is false when any of it is already on screen', () => {
    expect(isBelowWindow(at(799), 800)).toBe(false)
    expect(isBelowWindow(at(-400), 800)).toBe(false)
  })
})
