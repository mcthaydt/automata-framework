import { readFileSync } from 'node:fs'

// The documents' fixtures (editor suite spec §12): shipped files of three games, copied byte for byte. SOURCE.json
// records each one's repository, commit, path, length and sha256; fixtures.test.ts checks them.

/** The Last Light's shipped blockouts and facility (92e6704), the same bytes editor-3d tests its codecs on. */
export const FIXTURE_NAMES = [
  'blockout-clinic',
  'blockout-clinic-dawn',
  'blockout-bay',
  'blockout-prologue',
  'facility',
] as const

export type FixtureName = (typeof FIXTURE_NAMES)[number]

/** A Last Light fixture's text exactly as shipped: byte identity is what the codec tests assert. */
export function loadFixture(name: FixtureName): string {
  return readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')
}

/** Files recorded once from Last Light's own code (SOURCE.json says how), to compare ported code against. */
export function loadGolden(name: 'literals'): string {
  return readFileSync(new URL(`./fixtures/${name}.golden.json`, import.meta.url), 'utf8')
}

/** Every content file the documents are tested on, by file name: TOML of FloorFifty and AF, JSON of Last Light and AF. */
export const DOCUMENT_FIXTURES = [
  'floorfifty-tuning.toml',
  'floorfifty-juice.toml',
  'af-game.toml',
  'af-flow.toml',
  'af-stage-dawn.toml',
  'af-character-cyan.toml',
  'af-messages-fr.json',
  ...FIXTURE_NAMES.map((name) => `${name}.json` as const),
] as const

export type DocumentFixture = (typeof DOCUMENT_FIXTURES)[number]

export function loadDocumentFixture(name: DocumentFixture): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}
