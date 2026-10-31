// The Plan view's tool keys (ED3D.6g-a step 3; ED3D spec §10): V S X P D N choose a tool, and while a sector is being
// drawn Enter closes it, Backspace takes the last corner back and Escape drops the drawing. A command that would do
// nothing is disabled, so its key falls through to the page.
import { createCommandRegistry, createKeymap, type KeyInput } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { planToolCommands } from './plan-tool-commands'
import { createPlanTools } from './plan-tools'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const SIZE = { w: 800, h: 400 }

function setup() {
  const editor = createLevelEditor({ profile: afSectorProfile, level: depot })
  editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
  const tools = createPlanTools(editor, SIZE)
  const registry = createCommandRegistry()
  for (const command of planToolCommands(tools)) registry.register(command)
  const keymap = createKeymap(registry, 'apple')
  const press = (key: string): boolean =>
    keymap.handle({
      key,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      inText: false,
    } as KeyInput)
  const tap = (x: number, z: number) => {
    const at = { ...toScreen(planViewport(editor.view.state.camera, SIZE), { x, z }), kind: 'mouse' as const }
    tools.hover(at)
    tools.tap(at)
  }
  return { editor, tools, press, tap, registry }
}

describe('the plan tool keys', () => {
  it('chooses the tool each key names', () => {
    const { tools, press } = setup()
    for (const [key, tool] of [
      ['s', 'polygon'],
      ['x', 'vertex'],
      ['p', 'portal'],
      ['d', 'door'],
      ['n', 'window'],
      ['v', 'select'],
    ] as const) {
      expect(press(key)).toBe(true)
      expect(tools.state.tool).toBe(tool)
    }
  })

  it('closes, takes back a corner and drops the drawing with Enter, Backspace and Escape', () => {
    const { tools, press, tap, editor } = setup()
    press('s')
    tap(0, -4)
    tap(4, -4)
    tap(4, -2)
    tap(0, -2)
    expect(press('Backspace')).toBe(true)
    expect(tools.sector?.view.corners.length).toBe(3)
    expect(press('Enter')).toBe(true)
    expect(editor.history.undoLabel).toBe('Draw sector sector-1')
    tap(0, -8)
    expect(press('Escape')).toBe(true)
    expect(tools.sector?.view.corners).toEqual([])
  })

  it('lets Enter, Backspace and Escape fall through when nothing is being drawn', () => {
    const { press } = setup()
    expect(press('Enter')).toBe(false)
    expect(press('Backspace')).toBe(false)
    expect(press('Escape')).toBe(false)
    press('s')
    expect(press('Enter')).toBe(false)
    expect(press('Backspace')).toBe(false)
  })

  it('refuses a close with two corners in the tool sentence (ED3-m)', () => {
    const { tools, press, tap, editor } = setup()
    press('s')
    tap(0, -4)
    tap(4, -4)
    expect(press('Enter')).toBe(true)
    expect(tools.sector?.view.refusal).toMatch(/three corners/)
    expect(editor.history.canUndo).toBe(false)
  })
})
