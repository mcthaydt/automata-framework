import { REFERENCE_SIZES } from '@automataframework/automata/testing'
import { afterEach, describe, expect, test, vi } from 'vitest'
import page from '../../index.html?raw'
import { PRIMITIVES, start } from '../../main.ts'

// Examples convention: the demo boots, says it is ready, and logs no console errors.
let stop: (() => Promise<void>) | undefined
afterEach(async () => {
  await stop?.()
  stop = undefined
  document.body.innerHTML = ''
})

/** Watches console.error and console.warn while the demo runs. */
function consoleProblems(): string[] {
  const seen: string[] = []
  vi.spyOn(console, 'error').mockImplementation((...args) => void seen.push(`error: ${args.join(' ')}`))
  vi.spyOn(console, 'warn').mockImplementation((...args) => void seen.push(`warn: ${args.join(' ')}`))
  return seen
}

function target(): HTMLElement {
  return document.body.appendChild(document.createElement('div'))
}

async function readyOn(root: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(root.dataset.ready).toBe(''), { timeout: 5000 })
}

describe('ui/primitives demo', () => {
  test.each(PRIMITIVES)(
    'draws %s full-window with the geometry owner, ready and quiet',
    async (primitive) => {
      const problems = consoleProblems()
      stop = await start(
        target(),
        new URL(`http://demo.test/?frame=${primitive}&variant=host-reserved-right`),
      )
      await readyOn(document.documentElement)
      expect(document.documentElement.dataset.formFactor).toBeDefined()
      expect(document.querySelector(`[data-demo="${primitive}"]`)).not.toBeNull()
      expect(problems).toEqual([])
    },
  )

  // M4.6: each new primitive has a frame, and the frame draws it (the part named here is the primitive's own).
  test.each([
    ['split', '[data-split]'],
    ['options', 'fieldset input[type="radio"]'],
    ['pager', '[data-pager-dot]'],
    ['paged-grid', '[data-focus-grid]'],
    ['controls', 'input[role="switch"]'],
    ['chip', '[data-chip][data-tone="danger"]'],
    ['modal', '[data-modal-close]'],
    ['sheet', '[data-modal-scrim][data-anchor="bottom"]'],
    ['toast', '[data-toast]'],
    ['leaderboard', '[data-leaderboard] [data-entry][data-me]'],
  ] as const)('draws the M4.6 primitive %s', async (primitive, part) => {
    expect(PRIMITIVES).toContain(primitive)
    const problems = consoleProblems()
    stop = await start(target(), new URL(`http://demo.test/?frame=${primitive}`))
    await readyOn(document.documentElement)
    expect(document.querySelector(`[data-demo="${primitive}"] ${part}`)).not.toBeNull()
    expect(problems).toEqual([])
  })

  test('the gallery shows the chosen primitive at every reference size', async () => {
    const problems = consoleProblems()
    const root = target()
    stop = await start(root, new URL('http://demo.test/?show=dialog&variant=keyboard'))
    const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe[data-size]')]
    expect(frames.map((frame) => frame.dataset.size)).toEqual(REFERENCE_SIZES.map((size) => size.name))
    // Each card loads the page the gallery was opened from (a bundled copy of index.html is a 404).
    expect(frames[0]?.getAttribute('src')).toMatch(/^http:\/\/demo\.test\/\?frame=dialog/)
    expect(frames[0]?.getAttribute('src')).toContain('variant=keyboard')
    expect(root.querySelector('select[name="show"]')).not.toBeNull()
    expect(root.querySelector('select[name="variant"]')).not.toBeNull()
    expect(problems).toEqual([])
  })
})

test('asks the browser to lay the keyboard over the page rather than shrink it (spec §3.1)', () => {
  expect(page).toMatch(/<meta name="viewport" content="[^"]*interactive-widget=resizes-visual/)
})
