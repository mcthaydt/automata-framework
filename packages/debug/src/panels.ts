// Debug panels (M6 spec §4.2): a titled component the overlay shows as a tab. The id is kebab-case and unique; the title is a
// dev-only literal (debug text is not localized). A panel reads the host through the overlay's context, never props (DBG-D1).
import type { UiComponent } from '@mcthaydt/automata-ui'

export interface DebugPanelDef {
  readonly id: string
  readonly title: string
  readonly component: UiComponent
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** Checks the panels and returns them in the order given. Throws on a bad id, a repeated id or an empty title. */
export function debugPanels(...panels: readonly DebugPanelDef[]): readonly DebugPanelDef[] {
  const seen = new Set<string>()
  for (const panel of panels) {
    if (!KEBAB.test(panel.id)) throw new Error(`debug panel id "${panel.id}" is not kebab-case`)
    if (seen.has(panel.id)) throw new Error(`debug panel id "${panel.id}" is used twice`)
    if (panel.title.trim() === '') throw new Error(`debug panel "${panel.id}" needs a title`)
    seen.add(panel.id)
  }
  return Object.freeze([...panels])
}
