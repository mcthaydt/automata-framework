import { readFileSync } from 'node:fs'

/** The shipped Last Light files, in the order the plan lists them (SOURCE.json records where each came from). */
export const FIXTURE_NAMES = [
  'blockout-clinic',
  'blockout-clinic-dawn',
  'blockout-bay',
  'blockout-prologue',
  'facility',
] as const

export type FixtureName = (typeof FIXTURE_NAMES)[number]

/** A fixture's text exactly as shipped: byte identity is what the codec tests assert. */
export function loadFixture(name: FixtureName): string {
  return readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')
}
