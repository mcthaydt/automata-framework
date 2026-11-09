// What a thing is called when an undo label or a sentence names it. A thing the level writes is named by its definition
// and id (`Move ember ember-1`); one the game gives, furniture or a character or a lamp (`prop.crate`), by what it is
// (`Move crate`), because a person never wrote its definition and its id is only "crate-2".

const PLACED = /^(?:prop|kind|cast|lamp)\./

/** The words for a placed definition (`crate` for `prop.crate`, `lamp pendant` for `prop.lamp.pendant`); the id for any other. */
export const definitionWord = (def: string): string => def.replace(PLACED, '').replaceAll('.', ' ')

/** The undo label of `verb` on a thing: `Move crate` for what the game gives, `Move ember ember-1` for the rest. */
export const thingLabel = (verb: string, def: string, id: string): string =>
  PLACED.test(def) ? `${verb} ${definitionWord(def)}` : `${verb} ${def} ${id}`
