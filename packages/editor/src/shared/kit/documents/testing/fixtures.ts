import { readFileSync } from 'node:fs'

// The documents' fixtures: shipped files of three games, copied byte for byte. SOURCE.json
// records each one's repository, commit, path, length and sha256; fixtures.test.ts checks them.

/** Shipped 3D blockouts and a facility file, the same bytes editor-3d tests its codecs on. */
export const FIXTURE_NAMES = [
  'blockout-clinic',
  'blockout-clinic-dawn',
  'blockout-bay',
  'blockout-prologue',
  'facility',
] as const

export type FixtureName = (typeof FIXTURE_NAMES)[number]

/** A 3D fixture's text exactly as shipped: byte identity is what the codec tests assert. */
export function loadFixture(name: FixtureName): string {
  return readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')
}

/** Files recorded once from an independent implementation (SOURCE.json says how), to compare this code against. */
export function loadGolden(name: 'literals'): string {
  return readFileSync(new URL(`./fixtures/${name}.golden.json`, import.meta.url), 'utf8')
}

/** Every content file the documents are tested on, by file name: TOML and JSON, some shipped with games and some written for AF. */
export const DOCUMENT_FIXTURES = [
  'platformer-tuning.toml',
  'platformer-juice.toml',
  'af-game.toml',
  'af-flow.toml',
  'af-stage-dawn.toml',
  'af-character-cyan.toml',
  'af-messages-fr.json',
  'blockout-clinic.json',
  'blockout-clinic-dawn.json',
  'blockout-bay.json',
  'blockout-prologue.json',
  'facility.json',
] as const

export type DocumentFixture = (typeof DOCUMENT_FIXTURES)[number]

export function loadDocumentFixture(name: DocumentFixture): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}
