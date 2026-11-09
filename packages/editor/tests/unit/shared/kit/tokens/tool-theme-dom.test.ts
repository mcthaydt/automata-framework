// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import css from '#src/shared/kit/tool-theme.css?raw'

// The level canvas resolves a project colour with `getComputedStyle(...).getPropertyValue(...)` and parses a hex. A theme
// token must therefore read back as a plain colour in both looks, never as a function.
afterEach(() => {
  document.head.innerHTML = ''
  document.documentElement.removeAttribute('data-theme')
})

test('a script that reads a theme token gets a plain colour', () => {
  document.head.innerHTML = `<style>${css}</style>`
  expect(getComputedStyle(document.documentElement).getPropertyValue('--tool-panel').trim()).toBe('#ffffff')
})

test('a forced dark choice reads the dark colour, also as plain text', () => {
  document.head.innerHTML = `<style>${css}</style>`
  document.documentElement.dataset.theme = 'dark'
  expect(getComputedStyle(document.documentElement).getPropertyValue('--tool-panel').trim()).toBe('#1b1c20')
})
