import { readFileSync } from 'node:fs'

/** Samples written for this package (SOURCE.json says what each is for). */
export const AUTHORED_NAMES = ['depot.af-sector'] as const

export type AuthoredName = (typeof AUTHORED_NAMES)[number]

export function loadAuthored(name: AuthoredName): string {
  return readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')
}
