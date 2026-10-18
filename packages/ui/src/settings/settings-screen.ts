// One section of the Settings screen (M4 spec §4.8): one of the screen's own, as a snippet, or one an extension put in
// the `settings.sections` slot, as its component (it takes no props).
import type { Snippet } from 'svelte'
import type { UiComponent } from '../slots/ui-slot'

export type SettingsSection = { readonly snippet: Snippet } | { readonly component: UiComponent }
