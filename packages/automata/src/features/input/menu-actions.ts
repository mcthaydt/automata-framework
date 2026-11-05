// The fixed menu actions: they drive menus and the pause screen, never the sim, and are not part of
// a game's profile. Pad buttons follow FloorFifty `apps/client/src/managers/gamepad-source.ts` at `ac72660` (the
// `B` table, line 39: south 0 confirms, east 1 backs out, start 9 pauses, the D-pad 12–15 navigates), plus the
// shoulders for paging and the triggers for adjusting. The reserved keys (Escape) are allowed here: the reserved
// list applies to a game's profile only. Only `pause` will be rebindable.

/** A fixed menu action: it drives menus and the pause screen, never the sim. */
export type MenuAction =
  | 'nav-up'
  | 'nav-down'
  | 'nav-left'
  | 'nav-right'
  | 'confirm'
  | 'back'
  | 'page-prev'
  | 'page-next'
  | 'adjust-dec'
  | 'adjust-inc'
  | 'pause'

export interface MenuBinding {
  readonly keys: readonly string[]
  readonly pad: readonly number[]
}

export const MENU_BINDINGS: Readonly<Record<MenuAction, MenuBinding>> = {
  'nav-up': { keys: ['ArrowUp'], pad: [12] },
  'nav-down': { keys: ['ArrowDown'], pad: [13] },
  'nav-left': { keys: ['ArrowLeft'], pad: [14] },
  'nav-right': { keys: ['ArrowRight'], pad: [15] },
  confirm: { keys: ['Enter', 'Space'], pad: [0] },
  back: { keys: ['Escape'], pad: [1] },
  'page-prev': { keys: ['PageUp'], pad: [4] },
  'page-next': { keys: ['PageDown'], pad: [5] },
  'adjust-dec': { keys: [], pad: [6] },
  'adjust-inc': { keys: [], pad: [7] },
  pause: { keys: ['Escape'], pad: [9] },
}

/** `pause` is the one menu action live during play; the rest are live only in menus. */
export const isMenuActionLive = (action: MenuAction, context: 'play' | 'menu'): boolean =>
  action === 'pause' ? context === 'play' : context === 'menu'
