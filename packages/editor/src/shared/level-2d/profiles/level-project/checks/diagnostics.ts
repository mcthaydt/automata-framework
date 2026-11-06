import type { Diagnostic, Severity } from '../../profile'

// Builders the check groups share, so a path is spelled one way (`levels[moss-steps].layers[…]`).

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

/** The verb that agrees with a count: `agree(1, 'uses', 'use')` is "uses". */
export const agree = (count: number, one: string, many: string): string => (count === 1 ? one : many)

export function diagnostic(
  severity: Severity,
  code: string,
  path: string,
  message: string,
  fix?: string,
): Diagnostic {
  return fix === undefined ? { severity, code, path, message } : { severity, code, path, message, fix }
}

export const levelPath = (levelId: string): string => `levels[${levelId}]`
export const layerPath = (levelId: string, def: string): string => `${levelPath(levelId)}.layers[${def}]`
export const itemPath = (levelId: string, def: string, itemId: string): string =>
  `${layerPath(levelId, def)}.items[${itemId}]`
