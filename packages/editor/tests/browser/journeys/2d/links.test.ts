import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
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

// ED2D.8 journey: two RPG maps linked in the editor on an iPad: add the Inn on the
// map, place a door in each map with the Pencil, point each at the other through the picker, add a warp, have no
// errors, see the links on the world map, save, and reopen equal.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

/** Opens a view from the top bar's switcher. */
const rail = (name: string): Promise<void> => press('radio', name)

/** Opens a level from the Levels dock. */
/** Opens a level from the level picker in the top bar. */
async function openLevel(name: RegExp): Promise<void> {
  const picker = [...document.querySelectorAll<HTMLElement>('[data-testid="document-bar"] button')].find(
    (button) => button.getAttribute('aria-label')?.startsWith('Level: '),
  )
  if (picker === undefined) throw new Error('no level picker')
  picker.click()
  await arrived()
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((button) =>
    name.test(button.textContent ?? ''),
  )
  if (item === undefined) throw new Error(`no level ${name}`)
  item.click()
  await arrived()
}

/** Points the selected thing's Target at `choice` in `level`, through the picker. */
async function pointAt(level: RegExp, choice: string): Promise<void> {
  await pressButton('Choose target')
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog === null) throw new Error('no picker')
  const inside = (words: string | RegExp): HTMLElement => {
    const found = [...dialog.querySelectorAll<HTMLElement>('button')].find((button) =>
      typeof words === 'string' ? button.textContent?.includes(words) : words.test(button.textContent ?? ''),
    )
    if (found === undefined) throw new Error(`no ${words} in the picker`)
    return found
  }
  inside(level).click()
  await arrived()
  inside(choice).click()
  await arrived()
}

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'linking two maps at $name',
  (profile) => {
    it('adds the inn, links a door each way and a warp, has no errors, and reopens equal', async () => {
      editor = await openJourneyEditor(profile, 'topdown-rpg')
      const open = editor
      const pen = (): ReturnType<typeof createPointers> => createPointers(open.surface())

      await rail('Map')
      await pressButton('Add level')
      const field = document.querySelector<HTMLInputElement>(
        '[data-testid="world-inspector"] label.name input',
      )
      if (field === null) throw new Error('no name field')
      await userEvent.fill(field, 'Inn')
      await userEvent.keyboard('{Enter}')
      await arrived()
      expect(open.project().levels.map((level) => level.name)).toEqual(['Map 1', 'Inn'])

      await rail('Level')
      await chooseLayer('Entities')
      await press('radio', 'Brush')
      await press('radio', 'Door')
      await pen().tap(cellAt(open, 6, 4, 'map-1'), { kind: 'pen' })

      await openLevel(/Inn/)
      await pressButton('Fit the level in view')
      await chooseLayer('Entities')
      await press('radio', 'Brush')
      await press('radio', 'Door')
      await pen().tap(cellAt(open, 2, 12, 'level-1'), { kind: 'pen' })
      await pointAt(/^Map 1/, 'Door at')

      await openLevel(/Map 1/)
      await pressButton('Fit the level in view')
      await chooseLayer('Entities')
      await press('radio', 'Select')
      await pen().tap(cellAt(open, 6, 4, 'map-1'), { kind: 'pen' })
      await pointAt(/^Inn/, 'Door at')
      await press('radio', 'Brush')
      await press('radio', 'Warp')
      await pen().tap(cellAt(open, 12, 10, 'map-1'), { kind: 'pen' })
      await pointAt(/^Inn/, 'Door at')

      const targets = open
        .project()
        .levels.flatMap((level) => level.layers)
        .flatMap((layer) => (layer.kind === 'entities' ? layer.items : []))
        .filter((item) => item.fields['target'] !== undefined)
      expect(targets.map((item) => item.def).sort(), 'two doors and a warp lead somewhere').toEqual([
        'door',
        'door',
        'warp',
      ])

      // No problems: the top bar shows no count at all.
      expect(document.querySelector('[data-testid="problems"]')).toBeNull()

      await rail('Map')
      const saved = open.document.history.state as Project
      expect((await open.document.save()).status).toBe('saved')
      const again = await open.app.open(open.document.path)
      if (again.status !== 'opened') throw new Error(again.status)
      expect(printProject(again.document.history.state as Project)).toBe(printProject(saved))
    })
  },
)
