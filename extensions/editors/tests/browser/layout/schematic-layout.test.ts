import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuitePorts } from '@automata/editor/kit/ports'
import bay from '@automata/systems/testing/fixtures/bay.systems.toml?raw'
import { mount, unmount } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import CharacterCanvas from '#src/features/schematic/CharacterCanvas.svelte'
import { SchematicSession } from '#src/features/schematic/schematic-session.svelte.ts'

// The diagram with the production CSS in a real browser, at a phone (390x844) and an iPad (820x1180): every box and label
// is at least 44 px at the smallest zoom, the diagram scrolls inside its own region rather than shrinking or widening
// the page, and Fit puts it back.

const files = new Map<string, string>([['content/systems/bay.toml', bay]])
const ports = {
  workspace: {
    read: async (path: string) =>
      files.has(path) ? { text: files.get(path) as string, mtime: 1 } : undefined,
    write: async () => ({ ok: false, reason: 'policy', message: 'read only here' }),
    files: async () => [],
    remove: async () => ({ ok: false, reason: 'policy', message: 'read only here' }),
    generated: async () => undefined,
  },
} as unknown as SuitePorts

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'iPad', width: 820, height: 1180 },
] as const

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (mounted) void unmount(mounted)
  mounted = undefined
  document.body.innerHTML = ''
})

async function start(size: (typeof SIZES)[number], gameUrl?: string) {
  await page.viewport(size.width, size.height)
  const session = new SchematicSession(
    ports,
    { usesSystems: true, listsSystems: true, listsNav: true, gameUrl, twoD: false },
    ['bay'],
  )
  await session.select('bay')
  // `bay` has two characters; the larger is the second.
  session.choose(Math.max(0, (session.def?.agents.length ?? 1) - 1))
  const target = document.body.appendChild(document.createElement('div'))
  target.style.width = `${size.width}px`
  mounted = mount(CharacterCanvas, { target, props: { session } })
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return session
}

describe.each(SIZES)('the diagram on a $name', (size) => {
  test('every box and label is at least 44 px', async () => {
    await start(size)
    const targets = [...document.querySelectorAll<SVGGElement>('svg [role="button"]')]
    expect(targets.length).toBeGreaterThan(8)
    for (const target of targets) {
      const { width, height } = target.getBoundingClientRect()
      expect(height, target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
      expect(width, target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
    }
  })

  test('scrolls in its own region and never widens the page', async () => {
    await start(size)
    const region = document.querySelector<HTMLElement>('.scroll')
    expect(region).not.toBeNull()
    expect(
      (region?.scrollWidth ?? 0) > (region?.clientWidth ?? 0) ||
        (region?.scrollHeight ?? 0) > (region?.clientHeight ?? 0),
    ).toBe(true)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  test('Fit puts the diagram back at its smallest size', async () => {
    await start(size)
    const svg = document.querySelector<SVGSVGElement>('svg.diagram')
    const before = svg?.getBoundingClientRect().width ?? 0
    const buttons = [...document.querySelectorAll('button')]
    buttons.find((b) => b.textContent?.trim() === 'Bigger')?.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(svg?.getBoundingClientRect().width ?? 0).toBeGreaterThan(before)
    buttons.find((b) => b.textContent?.trim() === 'Fit')?.click()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(svg?.getBoundingClientRect().width ?? 0).toBeCloseTo(before, 0)
  })
})

describe.each(SIZES)('Watch on a $name', (size) => {
  test('opens beside the diagram without widening the page, and its button is at least 44 px', async () => {
    await start(size, 'http://localhost:5173/')
    const toggle = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Watch it run',
    )
    expect(toggle).toBeDefined()
    expect(toggle?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    toggle?.click()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const pane = document.querySelector<HTMLElement>('section[aria-label="Watch"]')
    expect(pane).not.toBeNull()
    expect(pane?.getBoundingClientRect().width ?? 0).toBeLessThanOrEqual(window.innerWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // The diagram is still there to look at, with its targets still as large as before.
    for (const target of document.querySelectorAll<SVGGElement>('svg [role="button"]'))
      expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })
})
