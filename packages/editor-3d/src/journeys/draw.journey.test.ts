import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '../main.css'
import { arrived, IPAD_PROFILES, turned } from '@automata/editor/kit/testing'
import { byTestId } from '@automata/framework/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import {
  buttonNamed,
  chooseTool,
  chooseView,
  openDepotJourney,
  undoLabel,
  unnamedControls,
} from '../testing/journey-editor'
import { stopEditor } from '../testing/layout-start'

// The 3D editor's iPad journeys (plan ED3D.11; ED3D spec §10, §13), in WebKit with touch and real pointer events. Drawing
// with the Pencil (ED3-c), the palm that rests while it draws (ED3-g), a two-finger tap that undoes and a three-finger
// tap that redoes. What the real hardware does with these stays the Owner's device pass.

const [PRO_11] = IPAD_PROFILES
if (PRO_11 === undefined) throw new Error('no iPad profile')

afterEach(stopEditor)

describe('ED3-c with the Pencil on an iPad 11" in landscape', () => {
  it('a rectangle drawn with the Pencil against the dock’s south wall is offered a portal, and Portal adds it', async () => {
    const editor = await openDepotJourney(PRO_11)
    chooseTool('Sector')
    await arrived()
    buttonNamed('Rectangle').click()
    await arrived()
    const pointers = editor.pointers()
    await pointers.tap(editor.at(8, 6), { kind: 'pen' })
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await arrived()
    expect(byTestId('document-frame').textContent).toContain(
      'Shares a 6.00 m wall with dock. Make it a portal?',
    )
    buttonNamed('Make portal').click()
    await arrived()
    expect(undoLabel()).toMatch(/^Undo Draw sector sector-1/)
  })
})

describe('ED3-g: a palm rests on the glass while the Pencil draws', () => {
  it('is ignored: the Pencil’s three taps still draw the rectangle, and the palm moves nothing', async () => {
    const editor = await openDepotJourney(PRO_11)
    chooseTool('Sector')
    await arrived()
    buttonNamed('Rectangle').click()
    await arrived()
    const pointers = editor.pointers()
    const palm = await pointers.palm(editor.at(2, 6))
    await pointers.tap(editor.at(8, 6), { kind: 'pen' })
    await palm.move(editor.at(2.5, 6.5))
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await palm.release()
    await arrived()
    expect(byTestId('document-frame').textContent).toContain('Make it a portal?')
    buttonNamed('Make portal').click()
    await arrived()
    expect(undoLabel()).toMatch(/^Undo Draw sector/)
  })
})

describe('ED3-h: the iPad turns while a rectangle is half drawn', () => {
  it('keeps the first corner through the turn: Undo point is still on offer and takes it back', async () => {
    const editor = await openDepotJourney(PRO_11)
    chooseTool('Sector')
    await arrived()
    buttonNamed('Rectangle').click()
    await arrived()
    await editor.pointers().tap(editor.at(8, 6), { kind: 'pen' })
    await arrived()
    expect(buttonNamed('Undo point')).not.toBeDisabled()
    await page.viewport(turned(PRO_11).width, turned(PRO_11).height)
    await arrived()
    // The tool and its half-drawn shape are still there in the other orientation.
    expect(document.querySelector('[role="toolbar"][aria-label="Tools"]')).not.toBeNull()
    expect(buttonNamed('Undo point')).not.toBeDisabled()
    buttonNamed('Undo point').click()
    await arrived()
    // With no corner left there is nothing to undo, so the option goes.
    expect(() => buttonNamed('Undo point')).toThrow()
    expect(undoLabel()).toBe('Undo')
  })
})

describe('two fingers undo and three fingers redo', () => {
  it('a two-finger tap undoes the last step; a three-finger tap redoes it', async () => {
    const editor = await openDepotJourney(PRO_11)
    chooseTool('Sector')
    await arrived()
    buttonNamed('Rectangle').click()
    await arrived()
    const pointers = editor.pointers()
    await pointers.tap(editor.at(8, 6), { kind: 'pen' })
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await pointers.tap(editor.at(14, 7.5), { kind: 'pen' })
    await arrived()
    buttonNamed('Make portal').click()
    await arrived()
    expect(undoLabel()).toMatch(/^Undo Draw sector/)
    const centre = editor.at(6, 2)
    const twoFingers = await Promise.all([
      pointers.down('touch', centre),
      pointers.down('touch', { x: centre.x + 60, y: centre.y }),
    ])
    for (const finger of twoFingers) await finger.release()
    await arrived()
    expect(undoLabel()).toBe('Undo')
    const threeFingers = await Promise.all([
      pointers.down('touch', centre),
      pointers.down('touch', { x: centre.x + 60, y: centre.y }),
      pointers.down('touch', { x: centre.x + 120, y: centre.y }),
    ])
    for (const finger of threeFingers) await finger.release()
    await arrived()
    expect(undoLabel()).toMatch(/^Undo Draw sector/)
  })
})

describe('the Pencil hovering over the plan', () => {
  it('reads the point under it and changes nothing', async () => {
    const editor = await openDepotJourney(PRO_11)
    const pointers = editor.pointers()
    await pointers.pencilHover([editor.at(4, 3), editor.at(5, 3.5)])
    await arrived()
    const words = document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent ?? ''
    expect(words).toMatch(/x \S+ m · z \S+ m/)
    expect(undoLabel()).toBe('Undo')
  })
})

describe('every control has a name a screen reader can say', () => {
  it('on the plan, in Walk and in the definitions sheet', async () => {
    await openDepotJourney(PRO_11)
    expect(unnamedControls()).toEqual([])
    chooseView('Walk')
    await arrived()
    expect(unnamedControls()).toEqual([])
    chooseView('Plan')
    await arrived()
    buttonNamed('Definitions…').click()
    await arrived()
    expect(unnamedControls()).toEqual([])
  })
})
