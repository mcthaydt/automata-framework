import '../../../../src/shared/kit/tokens.css'
import '../../../../src/shared/kit/fonts.css'
import '../../../../src/app/editor-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { IPAD_PROFILES } from '../../../../src/testing/kit/ipad-profiles.ts'
import { arrived } from '../../../../src/testing/kit/layout-sizes.ts'
import { createPointers } from '../../../../src/testing/kit/pointers.ts'
import {
  cellAt,
  chooseLayer,
  type JourneyEditor,
  openJourneyEditor,
  press,
  pressButton,
} from '../../../../src/testing/level-2d/journey-editor'

// ED2D.8 journey 1 (2D editor spec §14, §15 G-j): a platformer level on an iPad, end to end with real pointer events:
// the Pencil's hover shows the brush footprint, a Pencil stroke paints as one undo step, a two-finger tap undoes it,
// an entity is placed with the Pencil, the Checks view has no errors, and Export downloads the working file and the game
// files. What real hardware does with them stays the Owner's device pass.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

const shot = async (element: HTMLElement): Promise<string> =>
  page.screenshot({ element, base64: true, save: false }) as unknown as string

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the platformer journey at $name',
  (profile) => {
    it('hovers, strokes, undoes with two fingers, places, checks and exports', async () => {
      editor = await openJourneyEditor(profile, 'platformer')
      const open = editor
      await chooseLayer('Collision')
      const pointers = createPointers(open.surface())
      const row = [3, 4, 5, 6, 7].map((cx) => cellAt(open, cx, 9))

      // The Pencil's hover shows the brush's footprint: the canvas differs while it hovers over a cell. The first move
      // after a screenshot only wakes the canvas, so the hover is two moves a settled frame apart.
      await arrived()
      await shot(open.surface())
      const bare = await shot(open.surface())
      for (const cell of row.slice(0, 2)) {
        if (cell === undefined) continue
        await pointers.pencilHover([cell])
        await arrived()
      }
      expect(await shot(open.surface()), 'the hover footprint is drawn').not.toBe(bare)

      // A Pencil stroke is one undo step.
      const revision = open.document.history.revision
      await pointers.pencilStroke(row)
      expect(open.document.history.revision).toBe(revision + 1)
      expect(open.document.history.undoLabel).toBe('Paint')

      // A two-finger tap undoes it.
      const [a, b] = [cellAt(open, 10, 12), cellAt(open, 14, 12)]
      const first = await pointers.down('touch', a)
      const second = await pointers.down('touch', b)
      await first.release()
      await second.release()
      expect(open.document.history.revision, 'undone').toBe(revision + 2)
      expect(open.document.history.canRedo).toBe(true)

      // Place a coin on the Entities layer (the Pencil has been used, so a finger would only navigate).
      await chooseLayer('Entities')
      await press('radio', 'Brush')
      await press('radio', 'Coin')
      const before = open.project().levels[0]?.layers.find((layer) => layer.kind === 'entities')
      await pointers.tap(cellAt(open, 8, 6), { kind: 'pen' })
      const placed = open.project().levels[0]?.layers.find((layer) => layer.kind === 'entities')
      const count = (layer: typeof before): number => (layer?.kind === 'entities' ? layer.items.length : -1)
      expect(count(placed)).toBe(count(before) + 1)

      // No errors in Checks.
      await press('tab', 'Checks')
      expect(document.querySelector('[data-testid="checks-view"]')?.textContent).not.toMatch(/^Errors/m)

      // Export downloads the files.
      await press('tab', 'Export')
      await pressButton('Download')
      await expect
        .poll(() => open.downloads.map((file) => file.name))
        .toContain('untitled-platformer.af2d.json')
      expect(open.downloads.length, 'the working file and the game files').toBeGreaterThan(1)
    })
  },
)
