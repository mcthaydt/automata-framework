import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { IPAD_PROFILES } from '#src/testing/kit/ipad-profiles.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import { createPointers } from '#src/testing/kit/pointers.ts'
import {
  cellAt,
  chooseLayer,
  type JourneyEditor,
  openJourneyEditor,
  press,
  pressButton,
} from '#src/testing/level-2d/journey-editor.ts'

// ED2D.8 journey 1: a platformer level on an iPad, end to end with real pointer events:
// the Pencil's hover shows the brush footprint, a Pencil stroke paints as one undo step, a two-finger tap undoes it,
// an entity is placed with the Pencil, the top bar shows no problems, and Share's Download keeps the level's file. What
// real hardware does with them stays the Owner's device pass.

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
    it('hovers, strokes, undoes with two fingers, places and downloads', async () => {
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

      // A two-finger tap undoes it. The fingers land together and lift together, as a person taps: one after the other
      // with a frame between each would take four frames, and a loaded runner's frames can push that past the tap's
      // 300 ms, which is then rightly not a tap.
      const [a, b] = [cellAt(open, 10, 12), cellAt(open, 14, 12)]
      const fingers = await Promise.all([pointers.down('touch', a), pointers.down('touch', b)])
      await Promise.all(fingers.map((finger) => finger.release()))
      expect(open.document.history.revision, 'undone').toBe(revision + 2)
      expect(open.document.history.canRedo).toBe(true)

      // Place a coin on the Entities layer (the Pencil has been used, so a finger would only navigate).
      await chooseLayer('Characters')
      await press('radio', 'Brush')
      await press('radio', 'Coin')
      const before = open.project().levels[0]?.layers.find((layer) => layer.kind === 'entities')
      await pointers.tap(cellAt(open, 8, 6), { kind: 'pen' })
      const placed = open.project().levels[0]?.layers.find((layer) => layer.kind === 'entities')
      const count = (layer: typeof before): number => (layer?.kind === 'entities' ? layer.items.length : -1)
      expect(count(placed)).toBe(count(before) + 1)

      // No problems: the top bar shows no count.
      expect(document.querySelector('[data-testid="problems"]')).toBeNull()

      // Share, Download keeps the level's file.
      await pressButton('Share')
      await press('menuitem', 'Download')
      await expect
        .poll(() => open.downloads.map((file) => file.name))
        .toContain('untitled-platformer.af2d.json')
    })
  },
)
