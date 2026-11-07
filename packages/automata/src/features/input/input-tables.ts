// What the Input reads from the pads for one set of bindings: built once per profile, not per poll.
import { actionsForPadButton, type InputProfile, type StickDirection } from './input-profile.schema.js'
import { MENU_BINDINGS, type MenuAction, menuActionsFor } from './menu-actions.js'

const isNav = (action: MenuAction): boolean => action.startsWith('nav-')

/** The pad buttons worth reading (the game's and the menu's, ascending) and what each, and each stick direction, drives. */
export interface InputTables {
  readonly watched: readonly number[]
  readonly padActions: ReadonlyMap<number, readonly string[]>
  /** Menu actions by pad button, without the directions: those come through the held-direction repeat. */
  readonly padMenu: ReadonlyMap<number, readonly MenuAction[]>
  readonly stickActions: ReadonlyMap<StickDirection, readonly string[]>
}

export function tablesFor(bound: InputProfile): InputTables {
  const watched = [
    ...new Set([
      ...Object.values(bound.bindings).flatMap((binding) => binding.pad),
      ...Object.values(MENU_BINDINGS).flatMap((binding) => binding.pad),
    ]),
  ].sort((a, b) => a - b)
  const padActions = new Map(watched.map((button) => [button, actionsForPadButton(bound, button)]))
  // Menu directions from a pad come through the repeat, from the D-pad and the left stick alike.
  const padMenu = new Map(
    watched.map((button) => [
      button,
      menuActionsFor((binding) => binding.pad.includes(button)).filter((action) => !isNav(action)),
    ]),
  )
  const stickActions = new Map<StickDirection, string[]>()
  for (const [action, binding] of Object.entries(bound.bindings))
    for (const direction of binding.stick ?? [])
      stickActions.set(direction, [...(stickActions.get(direction) ?? []), action])
  return { watched, padActions, padMenu, stickActions }
}
