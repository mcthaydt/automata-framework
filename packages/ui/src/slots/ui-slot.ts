import type { Component } from 'svelte'

/**
 * The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).
 *
 * Closed: an extension cannot add a slot. The screens that render each slot arrive with those
 * screens (title and pause in M1.5, settings and HUD in M4, the debug overlay in M6).
 */
export const UI_SLOT_NAMES = [
  /** Extra buttons on the title screen's action bar. */
  'title.actions',
  /** Extra buttons on the pause screen's action bar. */
  'pause.actions',
  /** A section in Settings. */
  'settings.sections',
  /** Drawn over gameplay, inside the visible region. */
  'hud.overlay',
  /** A panel in the debug overlay. */
  'debug.panels',
] as const

/** The name of a place an extension may add UI: one of `UI_SLOT_NAMES`. */
export type UiSlotName = (typeof UI_SLOT_NAMES)[number]

/** What an extension puts in a slot: a Svelte component that takes no props. */
export type UiComponent = Component<Record<string, never>>
