import demos from 'virtual:framework/demos'
import type { Demo } from '../shared/framework/demos'

export type { Demo } from '../shared/framework/demos'

/** Emberwick and the feature demos, read from the workspace when the site is built (src/shared/framework/demos.ts). */
export function getDemosCatalog(): readonly Demo[] {
  return demos
}
