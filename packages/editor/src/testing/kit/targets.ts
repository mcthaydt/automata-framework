import { type Targets, TOUCH_TARGETS } from '@automata/framework/testing'

/**
 * With a mouse the editors are dense, as the approved mockup draws them: rows and controls 32 px, a primary too
 * (`tool-chrome.css`). Nothing an editor draws may be smaller.
 */
const MOUSE_TARGETS: Targets = { hit: 32, primary: 32 }

/**
 * The sizes an editor's controls are held to under the pointer this test runs with, by the same media queries
 * `tool-chrome.css` uses: the touch rule (44 px, a primary 48) once any coarse pointer is present, else 32 px for a
 * fine pointer that hovers. The layout tests run in a plain browser (a mouse) and again with touch, so both hold.
 */
export function editorTargets(): Targets {
  const touch = matchMedia('(any-pointer: coarse)').matches
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches
  return touch || !mouse ? TOUCH_TARGETS : MOUSE_TARGETS
}
