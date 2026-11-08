// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import css from '#src/shared/kit/tool-theme.css?raw'

// The level canvas resolves a project colour with `getComputedStyle(...).getPropertyValue(...)` and parses a hex. A theme
// token must therefore read back as a plain colour in both looks, never as a function.
afterEach(() => {
  document.head.innerHTML = ''
  document.documentElement.removeAttribute('data-theme')
})

test('a page with no attribute is dark, and a script that reads a theme token gets a plain colour', () => {
  document.head.innerHTML = `<style>${css}</style>`
  expect(getComputedStyle(document.documentElement).getPropertyValue('--tool-panel').trim()).toBe('#111316')
})

test('a forced light choice reads the light colour, also as plain text', () => {
  document.head.innerHTML = `<style>${css}</style>`
  document.documentElement.dataset.theme = 'light'
  expect(getComputedStyle(document.documentElement).getPropertyValue('--tool-panel').trim()).toBe('#ffffff')
})

test('Match device keeps dark when the device does not ask for light', () => {
  document.head.innerHTML = `<style>${css}</style>`
  document.documentElement.dataset.theme = 'device'
  expect(getComputedStyle(document.documentElement).getPropertyValue('--tool-panel').trim()).toBe('#111316')
})
