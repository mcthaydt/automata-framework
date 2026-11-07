// One section of the Settings screen: one of the screen's own, as a snippet, or one an extension put in
// the `settings.sections` slot, as its component (it takes no props).
import type { Snippet } from 'svelte'
import type { UiComponent } from '../../../shared/ui/slots/ui-slot'

/** A section of the Settings screen: the screen's own snippet, or an extension's slot component. */
export type SettingsSection = { readonly snippet: Snippet } | { readonly component: UiComponent }

/** A tab of the Settings screen (FloorFifty's Settings and Controls): its label and its sections, in order. */
export interface SettingsTab {
  readonly id: string
  readonly label: string
  readonly sections: readonly SettingsSection[]
}
