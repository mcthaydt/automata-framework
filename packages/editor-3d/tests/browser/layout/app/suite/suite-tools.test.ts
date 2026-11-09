import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import { editorList, type OpenedSuite, openSuite } from '@automata/editor/suite/testing/layout'
import { afterEach, describe, expect, test } from 'vitest'
import { createLevels3d } from '#src/features/levels-3d/levels-3d-suite-editor.ts'
import type { PlanRendererFactory } from '#src/features/levels-3d/plan/plan-renderer.ts'
import depot from '#src/testing/fixtures/depot.af-sector.json?raw'

// Levels 3D's drawing tools lie along the top bar. Where the window is as wide as a tablet held sideways every tool is on
// screen, named whole: the bar scrolls sideways only for a window too narrow to hold them (a phone, a small window).

const FILES = {
  [EDITOR_LIST_PATH]: editorList('content/levels/*.af-sector.json', 'levels-3d'),
  'content/tuning.toml': '[player]\nspeed = 6\n',
  'content/levels/depot.af-sector.json': depot,
}

const renderer: PlanRendererFactory = async () => ({
  paused: {
    subscribe: (run: (value: boolean) => void) => {
      run(false)
      return () => {}
    },
  },
  draw: () => {},
  resize: () => {},
  destroy: () => {},
})

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

describe.each(SIZES.filter((size) => size.width >= 1100))(
  'The plan’s tools in the top bar at $name ($width x $height)',
  (size) => {
    test('every tool is whole and inside the window, with nothing to scroll', async () => {
      opened = await openSuite(
        size,
        [
          fixtureEditor as SuiteEditor<unknown>,
          createLevels3d({ now: () => 0, renderer, schedule: () => () => {} }) as SuiteEditor<unknown>,
        ],
        FILES,
        '[data-testid="plan-canvas"]',
        'Levels',
      )
      const tools = [...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].filter(
        (button) =>
          ['Select', 'Room', 'Corner', 'Doorway', 'Door', 'Window', 'Thing'].some(
            (name) => (button.textContent ?? '').trim() === name,
          ),
      )
      expect(tools.map((tool) => tool.textContent?.trim())).toEqual(
        expect.arrayContaining(['Select', 'Room', 'Window', 'Thing']),
      )
      for (const tool of tools) {
        const box = tool.getBoundingClientRect()
        expect(box.right, `${tool.textContent} is inside the window`).toBeLessThanOrEqual(size.width)
        expect(tool.scrollWidth, `${tool.textContent} is not cut`).toBeLessThanOrEqual(Math.ceil(box.width))
      }
      const strip = document.querySelector<HTMLElement>('.tools[data-scroll-region]')
      expect(strip?.scrollWidth ?? 0).toBeLessThanOrEqual((strip?.clientWidth ?? 0) + 1)
    })
  },
)
