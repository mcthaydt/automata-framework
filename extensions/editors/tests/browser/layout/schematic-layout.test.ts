import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuitePorts } from '@automata/editor/kit/ports'
import bay from '@automata/systems/testing/fixtures/bay.systems.toml?raw'
import { mount, unmount } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import CharacterCanvas from '#src/features/schematic/CharacterCanvas.svelte'
import { reveal } from '#src/features/schematic/diagram/reveal.ts'
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

/** Presses a button by its words and waits for the page to settle. */
async function press(words: string): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim() === words,
  )
  button?.click()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

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

  test('Fit takes the diagram back from Bigger, to no more than its natural size', async () => {
    await start(size)
    const svg = document.querySelector<SVGSVGElement>('svg.diagram')
    const before = svg?.getBoundingClientRect().width ?? 0
    await press('Bigger')
    expect(svg?.getBoundingClientRect().width ?? 0).toBeGreaterThan(before)
    await press('Fit')
    expect(svg?.getBoundingClientRect().width ?? 0).toBeLessThanOrEqual(before)
  })

  test('Smaller shrinks the diagram below its natural size, and no target goes under 44 px', async () => {
    await start(size)
    const svg = document.querySelector<SVGSVGElement>('svg.diagram')
    const before = svg?.getBoundingClientRect().width ?? 0
    for (let i = 0; i < 4; i++) await press('Smaller')
    expect(svg?.getBoundingClientRect().width ?? 0).toBeLessThan(before)
    for (const target of document.querySelectorAll<SVGGElement>('svg [role="button"]')) {
      const box = target.getBoundingClientRect()
      expect(box.height, target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
      expect(box.width, target.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
    }
  })

  test('Fit shows the box where the character starts', async () => {
    await start(size)
    await press('Bigger')
    await press('Bigger')
    await press('Fit')
    const region = document.querySelector<HTMLElement>('.scroll')?.getBoundingClientRect()
    const where = document.querySelector<SVGGElement>('svg .box[data-start="true"]')?.getBoundingClientRect()
    expect(where).toBeDefined()
    expect(where?.left).toBeGreaterThanOrEqual((region?.left ?? 0) - 1)
    expect(where?.right).toBeLessThanOrEqual((region?.right ?? 0) + 1)
    expect(where?.top).toBeGreaterThanOrEqual((region?.top ?? 0) - 1)
    expect(where?.bottom).toBeLessThanOrEqual((region?.bottom ?? 0) + 1)
  })

  test('reveal brings a box that is off the edge into the region', async () => {
    await start(size)
    await press('Bigger')
    await press('Bigger')
    const region = document.querySelector<HTMLElement>('.scroll') as HTMLElement
    const far = [...region.querySelectorAll<SVGGElement>('svg .box')].find(
      (box) => box.getBoundingClientRect().right > region.getBoundingClientRect().right,
    )
    expect(far, 'a box past the right edge').toBeDefined()
    reveal(region, far?.dataset.mode as string)
    const at = far?.getBoundingClientRect()
    expect(at?.right).toBeLessThanOrEqual(region.getBoundingClientRect().right + 1)
    expect(at?.left).toBeGreaterThanOrEqual(region.getBoundingClientRect().left - 1)
  })
})

/** The modes' boxes as [mode, left, top] in the page, and the arrows as the modes each joins. */
function board() {
  const boxes = [...document.querySelectorAll<SVGGElement>('svg .box')].map((box) => {
    const at = box.getBoundingClientRect()
    return { mode: box.dataset.mode as string, left: at.left, top: at.top }
  })
  const arrows = [...document.querySelectorAll<SVGGElement>('svg .label')]
    .map((label) => label.getAttribute('aria-label') ?? '')
    .sort()
  return { boxes, arrows }
}

describe.each(SIZES)('the board on a $name is tall', (size) => {
  test('the modes stack top to bottom, no box has its words cut, and the same arrows join the same modes', async () => {
    await start(size)
    const tall = board()
    const starts = tall.boxes.filter((box) => box.mode !== '*')
    expect(starts.length).toBeGreaterThan(2)
    // Stacked: no two levels share a row, so the boxes' tops are not all the same, and the page's lefts are fewer than its tops.
    expect(new Set(tall.boxes.map((box) => Math.round(box.top))).size).toBeGreaterThan(
      new Set(tall.boxes.map((box) => Math.round(box.left))).size,
    )
    for (const box of document.querySelectorAll<SVGGElement>('svg .box')) {
      const frame = box.querySelector('rect')?.getBBox()
      for (const text of box.querySelectorAll('text')) {
        const words = text.getBBox()
        expect(words.x + words.width, `${box.dataset.mode} words`).toBeLessThanOrEqual(
          (frame?.x ?? 0) + (frame?.width ?? 0),
        )
      }
    }
    // Wide at 1440 x 900: the same arrows, joining the same modes, with the levels left to right instead.
    if (mounted) void unmount(mounted)
    mounted = undefined
    document.body.innerHTML = ''
    await start({ name: 'desktop', width: 1440, height: 900 } as never)
    const wide = board()
    expect(wide.arrows).toEqual(tall.arrows)
    expect(new Set(wide.boxes.map((box) => Math.round(box.left))).size).toBeGreaterThan(
      new Set(wide.boxes.map((box) => Math.round(box.top))).size - 1,
    )
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
