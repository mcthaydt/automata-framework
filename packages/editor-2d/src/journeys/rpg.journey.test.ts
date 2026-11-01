import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { arrived, createPointers, IPAD_PROFILES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, it } from 'vitest'
import type { LayerInstance } from '../model/project-types'
import { cellAt, chooseLayer, type JourneyEditor, openJourneyEditor, press } from '../testing/journey-editor'

// ED2D.8 journey (2D editor spec §14): a top-down RPG map on an iPad: a Pencil stroke on the Ground tiles and one on the
// Walls (which the Wall art layer follows) are one undo step each, and a villager is placed with the Pencil.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

const layer = (open: JourneyEditor, def: string): LayerInstance | undefined =>
  open.project().levels[0]?.layers.find((each) => each.def === def)

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the RPG map at $name',
  (profile) => {
    it('paints ground and walls with the Pencil and places a villager', async () => {
      editor = await openJourneyEditor(profile, 'topdown-rpg')
      const open = editor
      const pointers = createPointers(open.surface())
      const row = (cy: number) => [3, 4, 5, 6, 7].map((cx) => cellAt(open, cx, cy))

      for (const [name, cy, def] of [
        ['Ground', 5, 'ground'],
        ['Walls', 8, 'walls'],
      ] as const) {
        await chooseLayer(name)
        // A tiles layer paints with a tile or value the palette offers: the first one not already picked.
        document
          .querySelector<HTMLElement>('#palette-heading')
          ?.parentElement?.querySelector<HTMLElement>('[role="radio"][aria-checked="false"]')
          ?.click()
        await arrived()
        const revision = open.document.history.revision
        const before = open.project()
        await pointers.pencilStroke(row(cy))
        expect(open.document.history.revision, `${name}: one step`).toBe(revision + 1)
        expect(open.project(), `${name}: the level changed`).not.toBe(before)
        expect(layer(open, def), `${name}: the layer changed`).not.toBe(
          before.levels[0]?.layers.find((each) => each.def === def),
        )
      }

      await chooseLayer('Entities')
      await press('radio', 'Brush')
      await press('radio', 'Villager')
      const entities = (): number => {
        const found = layer(open, 'entities')
        return found?.kind === 'entities' ? found.items.length : -1
      }
      const placed = entities()
      await pointers.tap(cellAt(open, 9, 6), { kind: 'pen' })
      expect(entities()).toBe(placed + 1)
    })
  },
)
