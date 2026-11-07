// `runtime.inputs` against the game's input bindings. A manifest that leaves out a device the
// game binds would have Ruken hide or refuse it; one that declares touch with nothing to touch promises a
// control scheme the game does not have. Gamepad may stand alone: menus always read the pad.

/**
 * What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private,
 * so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is
 * assignable to it.
 */
export interface ShipInputBindings {
  readonly [action: string]: {
    readonly pad?: readonly number[] | undefined
    readonly touch?: boolean | undefined
    readonly gesture?: readonly string[] | undefined
  }
}

/** Each disagreement between `runtime.inputs` and the bindings, in action order; empty when they agree. */
export function inputsProblems(inputs: readonly string[], bindings: ShipInputBindings): string[] {
  const actions = Object.keys(bindings).sort()
  const problems: string[] = []
  if (!inputs.includes('gamepad'))
    for (const action of actions)
      if ((bindings[action]?.pad?.length ?? 0) > 0)
        problems.push(`action "${action}" binds pad buttons but runtime.inputs has no "gamepad"`)
  const touchable = actions.some(
    (action) => bindings[action]?.touch === true || (bindings[action]?.gesture?.length ?? 0) > 0,
  )
  if (inputs.includes('touch') && !touchable)
    problems.push('runtime.inputs declares "touch" but no action binds a touch button or a gesture')
  return problems
}
