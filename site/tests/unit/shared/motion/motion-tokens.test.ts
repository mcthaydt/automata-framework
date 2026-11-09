import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOTION } from '#src/shared/motion/motion-tokens.ts'

// Vitest runs from the site's folder.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const tokensCss = read('src/shared/styles/tokens.css')
const baseCss = read('src/shared/styles/base.css')

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.(css|svelte)$/.test(name)) found.push(path)
  }
  return found
}

// The motion is "super subtle" by the Owner's word, so the limits are held by tests, not by memory.
describe('motion tokens', () => {
  it('keeps every duration, travel and scale inside the subtle limits', () => {
    for (const key of ['press', 'hover', 'ui', 'page', 'reveal', 'stagger'] as const) {
      expect(MOTION[key], key).toBeLessThanOrEqual(0.48)
    }
    for (const key of ['rise', 'settle', 'nudge'] as const) expect(MOTION[key], key).toBeLessThanOrEqual(8)
    expect(MOTION.scaleFrom).toBeGreaterThanOrEqual(0.98)
    expect(MOTION.productScaleFrom).toBeGreaterThanOrEqual(0.98)
  })

  it('lets the last staggered part finish within 0.78 s', () => {
    expect(MOTION.reveal + (MOTION.staggerCap - 1) * MOTION.stagger).toBeLessThanOrEqual(0.78)
  })

  it('is the kit’s --ease-out, as the same four numbers', () => {
    expect(MOTION.ease).toEqual([0.22, 1, 0.36, 1])
    // The editors' redesign is changing the kit's tokens: a rename fails here, not as a silent `ease`.
    expect(read('../packages/editor/src/shared/kit/tokens.css')).toContain(
      '--ease-out: cubic-bezier(0.22, 1, 0.36, 1)',
    )
  })

  it('declares the CSS tokens at the same values', () => {
    expect(tokensCss).toContain(`--t-press: ${MOTION.press * 1000}ms`)
    expect(tokensCss).toContain(`--t-hover: ${MOTION.hover * 1000}ms`)
    expect(tokensCss).toContain(`--t-ui: ${MOTION.ui * 1000}ms`)
    expect(tokensCss).toContain(`--nudge: ${MOTION.nudge}px`)
    expect(tokensCss).toContain(`--scale-from: ${MOTION.scaleFrom}`)
  })

  it('has one transition rule for the controls and the two keyframes the plan names', () => {
    expect(baseCss).not.toContain('@keyframes lift')
    expect(baseCss).not.toContain('@keyframes settle')
    expect(baseCss).toContain('@keyframes motion-rise')
    expect(baseCss).toContain('@keyframes motion-fade')
    const rules = [...baseCss.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter(
      ([, selector, body]) =>
        /(^|[\s,])button(,|\s|$)/.test(selector ?? '') && /transition\s*:/.test(body ?? ''),
    )
    expect(rules).toHaveLength(1)
    for (const selector of ['.button', '.demo-list a', '.docs-sidebar nav a', 'nav.link-row a']) {
      expect(rules[0]?.[1]).toContain(selector)
    }
  })

  it('uses no ease-in anywhere', () => {
    for (const file of sourceFiles(resolve(process.cwd(), 'src'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/ease-in/)
    }
  })
})
