import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { IPAD_PROFILES } from '#src/testing/kit/ipad-profiles.ts'
import { arrived } from '#src/testing/kit/layout-sizes.ts'
import {
  type JourneyEditor,
  openJourneyEditor,
  press,
  pressButton,
} from '#src/testing/level-2d/journey-editor.ts'

// ED2D.8 journey: retyping a level field somebody has filled in is refused with the levels it
// would break, Cancel changes nothing, and "Change anyway" is one undo step that Undo takes back.

let editor: JourneyEditor | undefined
afterEach(async () => {
  await editor?.close()
  editor = undefined
})

describe.each(IPAD_PROFILES.filter((profile) => profile.name === 'ipad-pro-11-landscape'))(
  'the retype refusal at $name',
  (profile) => {
    it('lists the levels it would break; Cancel keeps the field, Change anyway is one step', async () => {
      editor = await openJourneyEditor(profile, 'platformer')
      const open = editor
      const musicType = (): string | undefined => open.project().defs.levelFields[0]?.type

      const music = document.querySelector<HTMLInputElement>(
        '[data-testid="level-tab"] input, [role="tabpanel"] input[type="text"]',
      )
      if (music === null) throw new Error('no Music field')
      await userEvent.fill(music, 'theme')
      await userEvent.keyboard('{Enter}')
      await arrived()
      expect(open.document.history.undoLabel).toMatch(/music/i)

      await press('radio', 'Characters')
      const levelFields = [
        ...document.querySelectorAll<HTMLElement>('[data-testid="entities-panel"] button'),
      ].find((button) => button.textContent?.trim().startsWith('Every level'))
      if (levelFields === undefined) throw new Error('no Every level row')
      levelFields.click()
      await arrived()
      const before = open.document.history.revision
      await press('radio', 'Whole number')
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      expect(dialog?.textContent, 'the refusal names the level').toContain('level-1')
      expect(open.document.history.revision, 'nothing changed yet').toBe(before)
      expect(musicType()).toBe('text')

      await pressButton('Cancel')
      expect(musicType()).toBe('text')
      expect(open.document.history.revision).toBe(before)

      await press('radio', 'Whole number')
      await pressButton('Change anyway')
      expect(musicType()).toBe('int')
      expect(open.document.history.revision).toBe(before + 1)
      open.document.history.undo()
      expect(musicType()).toBe('text')
    })
  },
)
