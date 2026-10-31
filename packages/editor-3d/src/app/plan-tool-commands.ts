// The Plan view's tool commands and their keys (ED3D.6g-a, plan decision 3; ED3D spec §10): V S X P D N choose Select,
// Sector, Vertex, Portal, Door and Window; while a sector is being drawn Enter closes it, Backspace takes the last corner
// back and Escape drops the drawing. Each is a kit command, so the keymap, a menu and later tools share one registry,
// and a command that would do nothing is disabled so its key falls through to the page.
import { type Command, defineCommand } from '@mcthaydt/automata-editor-kit/core'
import type { PlanToolId, PlanTools } from './plan-tools'

const CHOOSE: readonly (readonly [key: string, tool: PlanToolId, title: string])[] = [
  ['V', 'select', 'Select'],
  ['S', 'polygon', 'Sector'],
  ['X', 'vertex', 'Vertex'],
  ['P', 'portal', 'Portal'],
  ['D', 'door', 'Door'],
  ['N', 'window', 'Window'],
]

export function planToolCommands(tools: PlanTools): readonly Command[] {
  const drawing = (): boolean => (tools.sector?.view.corners.length ?? 0) > 0
  return [
    ...CHOOSE.map(([key, tool, title]) =>
      defineCommand({ id: `plan.tool.${tool}`, title, shortcut: key, run: () => tools.choose(tool) }),
    ),
    defineCommand({
      id: 'sector.close',
      title: 'Close sector',
      shortcut: 'Enter',
      enabled: drawing,
      run: () => tools.sector?.close(),
    }),
    defineCommand({
      id: 'sector.undoPoint',
      title: 'Undo point',
      shortcut: 'Backspace',
      enabled: drawing,
      run: () => tools.sector?.undoCorner(),
    }),
    defineCommand({
      id: 'sector.cancel',
      title: 'Cancel the drawing',
      shortcut: 'Escape',
      enabled: drawing,
      run: () => tools.sector?.cancel(),
    }),
  ]
}
