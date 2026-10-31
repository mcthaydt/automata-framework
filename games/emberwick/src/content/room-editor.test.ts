import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROOM } from './room.ts'

// GAME-2D.ED: the room is authored in the 2D editor (`content/rooms/room-1.af2d.json`, a `level-project` file the editor
// opens through `content/editors.toml`) and this test holds the two spellings equal: the editor's collision rows and its
// two markers are exactly `ROOM.rows`. Until the content compiler reads the editor file, `room.ts` stays the source the
// sim hashes, so the golden is untouched by authoring.

interface EditorFile {
  levels: {
    size: { w: number; h: number }
    layers: { def: string; rows?: string[]; items?: { def: string; x: number; y: number }[] }[]
  }[]
}

const file = JSON.parse(
  readFileSync(new URL('../../content/rooms/room-1.af2d.json', import.meta.url), 'utf8'),
) as EditorFile

/** Decodes the working file's run-length row ("1 .*38 1") to one integer per cell. */
const decode = (row: string): number[] =>
  row.split(' ').flatMap((token) => {
    const [cell = '.', times = '1'] = token.split('*')
    return Array.from({ length: Number(times) }, () => (cell === '.' ? 0 : Number(cell)))
  })

describe('the room authored in the editor', () => {
  const level = file.levels[0]
  const collision = level?.layers.find((layer) => layer.def === 'collision')
  const entities = level?.layers.find((layer) => layer.def === 'entities')

  it('has the size of the room', () => {
    expect(level?.size).toEqual({ w: 8 * (ROOM.rows[0]?.length ?? 0), h: 8 * ROOM.rows.length })
  })

  it('has the same solid tiles', () => {
    const tiles = (collision?.rows ?? []).map((row) =>
      decode(row)
        .map((cell) => (cell === 1 ? '#' : '.'))
        .join(''),
    )
    expect(tiles).toEqual(ROOM.rows.map((row) => row.replace(/[PG]/g, '.')))
  })

  it('puts the start and the ember where the room does', () => {
    const at = (ch: string): { tx: number; ty: number } => {
      const ty = ROOM.rows.findIndex((row) => row.includes(ch))
      return { tx: (ROOM.rows[ty] ?? '').indexOf(ch), ty }
    }
    const start = entities?.items?.find((item) => item.def === 'player-start')
    const goal = entities?.items?.find((item) => item.def === 'goal')
    // The start stands on the bottom of its tile (pivot bottom centre); the ember is centred in its tile.
    expect({ tx: Math.floor((start?.x ?? 0) / 8), ty: Math.floor(((start?.y ?? 0) - 1) / 8) }).toEqual(
      at('P'),
    )
    expect({ tx: Math.floor((goal?.x ?? 0) / 8), ty: Math.floor((goal?.y ?? 0) / 8) }).toEqual(at('G'))
  })
})
