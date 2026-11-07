import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '../main.css'
import { arrived, createPointers, IPAD_PROFILES, type IpadProfile } from '@automata/editor/kit/testing'
import { byTestId } from '@automata/framework/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { buttonNamed, chooseView, openDepotJourney, undoLabel } from '../testing/journey-editor'
import { stopEditor } from '../testing/layout-start'

// The 3D editor's iPad journeys through Walk, the material sheet and the definitions sheet (plan ED3D.11; ED3D spec §5.3,
// §13): ED3-f (a finger taps a wall in Walk, makes it a window in the inspector, two fingers undo), retexturing a wall
// from the material sheet, and ED3-r (a definition and a field added with the keyboard). In WebKit with touch.

const [PRO_11] = IPAD_PROFILES
if (PRO_11 === undefined) throw new Error('no iPad profile')

afterEach(stopEditor)

const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''

async function inWalk(profile: IpadProfile): Promise<HTMLElement> {
  await openDepotJourney(profile)
  chooseView('Walk')
  await expect
    .poll(() => document.querySelector('[data-testid="walk-canvas"][data-phase="drawing"]'))
    .not.toBeNull()
  await arrived()
  return byTestId('walk-canvas')
}

async function tapCrosshair(walk: HTMLElement): Promise<void> {
  const box = walk.getBoundingClientRect()
  await createPointers(walk).tap({ x: box.width / 2, y: box.height / 2 }, { kind: 'touch' })
  await arrived()
}

describe('ED3-f on an iPad: Walk and the inspector share one selection and one history', () => {
  it('a finger picks the wall in front, the inspector makes it a window, and two fingers undo it', async () => {
    const walk = await inWalk(PRO_11)
    await tapCrosshair(walk)
    expect(statusWords()).toMatch(/Wall 3 of hall/)
    const kind = [
      ...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="Kind"] [role="radio"]'),
    ].find((each) => each.textContent?.trim() === 'Window')
    if (kind === undefined) throw new Error('no Window kind')
    kind.click()
    await arrived()
    expect(undoLabel()).toMatch(/^Undo/)
    expect(undoLabel()).not.toBe('Undo')
    const pointers = createPointers(walk)
    const centre = { x: 200, y: 200 }
    const fingers = await Promise.all([
      pointers.down('touch', centre),
      pointers.down('touch', { x: centre.x + 60, y: centre.y }),
    ])
    for (const finger of fingers) await finger.release()
    await arrived()
    expect(undoLabel()).toBe('Undo')
  })

  it('a finger drag looks around and never changes the level', async () => {
    const walk = await inWalk(PRO_11)
    const pointers = createPointers(walk)
    await pointers.drag(
      [
        { x: 300, y: 300 },
        { x: 360, y: 300 },
        { x: 420, y: 300 },
      ],
      { kind: 'touch' },
    )
    await arrived()
    expect(undoLabel()).toBe('Undo')
  })
})

describe('retexturing a wall from the material sheet', () => {
  it('opens on the picked wall, applies another material as one undo step and closes', async () => {
    const walk = await inWalk(PRO_11)
    await tapCrosshair(walk)
    buttonNamed('Material').click()
    await arrived()
    expect(document.querySelector('[role="dialog"][aria-labelledby]')).not.toBeNull()
    const floors = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="radiogroup"][aria-label="Categories"] [role="radio"]',
      ),
    ].find((each) => /^Floors/.test(each.textContent?.trim() ?? ''))
    floors?.click()
    await arrived()
    const tile = [
      ...document.querySelectorAll<HTMLElement>('[role="group"][aria-label="Materials"] [role="radio"]'),
    ].find((each) => each.getAttribute('aria-checked') === 'false')
    if (tile === undefined) throw new Error('no other material')
    tile.click()
    await arrived()
    buttonNamed('Apply').click()
    await arrived()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(undoLabel()).toMatch(/^Undo/)
    expect(undoLabel()).not.toBe('Undo')
  })
})

describe('ED3-r on an iPad: a definition and a field added from the sheet', () => {
  it('adds a lamp with a power field, each one undo step', async () => {
    await openDepotJourney(PRO_11)
    buttonNamed('Definitions…').click()
    await arrived()
    await page.getByLabelText('New definition id').fill('lamp')
    buttonNamed('Add definition').click()
    await arrived()
    await page.getByLabelText('New field in lamp').fill('power')
    buttonNamed('Add field to lamp').click()
    await arrived()
    expect(
      document.querySelector<HTMLInputElement>('input[aria-label="Field name in lamp: power"]'),
    ).not.toBeNull()
    buttonNamed('Done').click()
    await arrived()
    expect(undoLabel()).toMatch(/Set field power of lamp/)
  })
})
