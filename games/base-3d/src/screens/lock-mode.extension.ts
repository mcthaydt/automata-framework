// The Lock mode section in Settings (DESIGN.md §12.2), as an extension filling the `settings.sections` slot.
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import LockModeSection from './LockModeSection.svelte'

export const lockModeExtension: ExtensionDef<'base-3d-lock-mode'> = defineExtension({
  name: 'base-3d-lock-mode',
  ui: { slots: { 'settings.sections': LockModeSection } },
})
