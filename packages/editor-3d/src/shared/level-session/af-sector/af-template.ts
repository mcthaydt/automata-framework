// The file a New level starts from (ED3D spec §4.6, ED3D.13a): an `af-sector/2` level with an empty materials table, no
// sectors, the one definition every walkable level wants (a `single` spawn that faces a way, as the depot's) and no
// things. It is written by hand in the depot's layout, so the codec patches it like any authored file, and it is read
// back through the codec so the text and the model can never disagree.
import { AF_SECTOR_2_FORMAT, type AfSector2File } from '@automata/3d/level'
import { afSectorCodec } from './af-codec'

export type NewLevelResult =
  | { readonly ok: true; readonly text: string; readonly level: AfSector2File }
  | { readonly ok: false; readonly reason: string }

const SPAWN =
  '{"id": "spawn", "shape": "point", "single": true, "fields": [{"id": "facing", "type": "angle", "default": 0}]}'

export function newAfSectorLevel(name: string): NewLevelResult {
  const trimmed = name.trim()
  if (trimmed === '') return { ok: false, reason: 'a level has a name' }
  const text = [
    '{',
    `  "format": ${JSON.stringify(AF_SECTOR_2_FORMAT)},`,
    `  "name": ${JSON.stringify(trimmed)},`,
    '  "materials": {},',
    '  "sectors": [],',
    '  "entityDefs": [',
    `    ${SPAWN}`,
    '  ],',
    '  "entities": []',
    '}',
    '',
  ].join('\n')
  const parsed = afSectorCodec.parse(text)
  // The text is this function's own, so a refusal is a bug in it, not a person's mistake.
  if (!parsed.ok) throw new Error(`the new level template does not parse: ${JSON.stringify(parsed)}`)
  return { ok: true, text, level: parsed.value }
}
