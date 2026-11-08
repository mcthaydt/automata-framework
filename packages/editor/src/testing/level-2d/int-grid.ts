import { Grid } from '../../shared/level-2d/model/grid'

/** An IntGrid from rows of text: `.` is empty, `#` is the value 1 and `1` to `9` are that value; every row is as wide as the first. */
export function intGridOf(...rows: string[]): Grid {
  let grid = Grid.empty(rows[0]?.length ?? 0, rows.length)
  grid = grid.edit((cells) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x] as string
        if (ch !== '.') cells.set(x, y, ch === '#' ? 1 : Number(ch))
      }
    })
  })
  return grid
}
