// Debug panels: a titled component the overlay shows as a tab. The id is kebab-case and unique; the title is a
// dev-only literal (debug text is not localized). A panel reads the host through the overlay's context, never props.
import type { UiComponent } from '@automata/framework/extension'
import SummaryPanel from './SummaryPanel.svelte'

/**
 * One tab of the debug overlay: a kebab-case id that is not used twice, a title (debug words are
 * not translated) and the component that draws it.
 */
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

/**
 * A panel for an extension's summary: it lists `host.summaries[id].summary()` as rows. `debug` imports no extension, so
 * each extension exports a function that turns its state into a plain object and the game hands it over under this id.
 */
export function summaryPanel(id: string, title: string): DebugPanelDef {
  return { id, title, component: SummaryPanel }
}
