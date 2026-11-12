import '@automataframework/editor/tokens.css'
import '@automataframework/editor/fonts.css'
import '@automataframework/editor/suite.css'
import '@automataframework/editor/tool-chrome.css'
import type { SuitePorts } from '@automataframework/editor/kit/ports'
import { editorTargets } from '@automataframework/editor/kit/testing'
import bay from '@automataframework/systems/testing/fixtures/bay.systems.toml?raw'
import { mount, unmount } from 'svelte'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import SchematicPanel from '#src/features/schematic/SchematicPanel.svelte'
import { SchematicSession } from '#src/features/schematic/schematic-session.svelte.ts'

// The list down the left of Schematic, with the production CSS in a real browser, at the width the suite gives it on an iPad
// (a narrow rail beside the diagram): nothing in it, however long a ready-made character's description, may stretch past the
// rail, because the rail clips what overflows and "Add a character" would lose its label.

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

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (mounted) void unmount(mounted)
  mounted = undefined
  document.body.innerHTML = ''
})

describe.each([
  { name: 'phone', width: 390, height: 844, rail: 240 },
  { name: 'iPad', width: 820, height: 1180, rail: 263 },
])('the list on a $name', ({ width, height, rail }) => {
  test('stays inside its rail, and its buttons are at least touch size', async () => {
    await page.viewport(width, height)
    const session = new SchematicSession(
      ports,
      { usesSystems: true, listsSystems: true, listsNav: true, gameUrl: undefined, twoD: false },
      ['bay'],
    )
    await session.select('bay')
    // The suite's shell and main, which the kit's chrome (a select at touch size on macOS WebKit) is scoped to.
    const shell = document.body.appendChild(document.createElement('div'))
    shell.dataset.editorShell = ''
    const target = shell.appendChild(document.createElement('main'))
    target.style.width = `${rail}px`
    target.style.overflow = 'hidden'
    mounted = mount(SchematicPanel, { target, props: { session } })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const edge = target.getBoundingClientRect().right
    const things = [...target.querySelectorAll<HTMLElement>('button, select')]
    expect(things.length).toBeGreaterThan(3)
    for (const thing of things) {
      const box = thing.getBoundingClientRect()
      const label = thing.textContent?.trim() ?? thing.getAttribute('aria-label') ?? thing.tagName
      expect(box.right, label).toBeLessThanOrEqual(edge + 0.5)
      expect(box.height, label).toBeGreaterThanOrEqual(editorTargets().hit)
    }
  })
})
