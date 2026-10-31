import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { arrived, createPointers, IPAD_PROFILES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { printProject } from '../model/project-codec'
import type { Project } from '../model/project-types'
import {
  cellAt,
  chooseLayer,
  type JourneyEditor,
  openJourneyEditor,
  press,
  pressButton,
} from '../testing/journey-editor'

// ED2D.8 journey (2D editor spec §15 G-g, G-r): two RPG maps linked in the editor on an iPad: add the Inn on the World
// map, place a door in each map with the Pencil, point each at the other through the picker, add a warp, have no
// errors, see the links on the world map, save, and reopen equal.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

const rail = (name: string): Promise<void> => press('tab', name)

/** Opens a level from the Levels dock. */
async function openLevel(name: RegExp): Promise<void> {
  const dock = document.querySelector<HTMLElement>('nav[aria-label="Levels"]')
  const card = [...(dock?.querySelectorAll<HTMLElement>('button') ?? [])].find((button) =>
    name.test(button.textContent ?? ''),
  )
  if (card === undefined) throw new Error(`no level ${name}`)
  card.click()
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

      await rail('World')
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
      await pressButton('Fit')
      await chooseLayer('Entities')
      await press('radio', 'Brush')
      await press('radio', 'Door')
      await pen().tap(cellAt(open, 2, 12, 'level-1'), { kind: 'pen' })
      await pointAt(/^Map 1/, 'Door at')

      await openLevel(/Map 1/)
      await pressButton('Fit')
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

      await rail('Checks')
      const view = document.querySelector<HTMLElement>('[data-testid="checks-view"]')
      expect(view?.textContent).not.toMatch(/Errors|Warnings/)

      await rail('World')
      const saved = open.document.history.state as Project
      expect((await open.document.save()).status).toBe('saved')
      const again = await open.app.open(open.document.path)
      if (again.status !== 'opened') throw new Error(again.status)
      expect(printProject(again.document.history.state as Project)).toBe(printProject(saved))
    })
  },
)
