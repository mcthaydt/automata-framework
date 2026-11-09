// The painter makes the same bytes in every engine: the oracle frames the source painter made are painted here, in the
// page, from the inputs Node painted them from, and each cell must hash as Node's does (tests/unit/figures/paint holds
// Node's to the oracle's own md5s, and the frame it drew one eye in is held to two eyes there).
import { describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import { type CellInput, paintCell } from '#src/features/figures/paint/paint-cell.ts'
import { cellHash, fromWire } from '#src/testing/wire.ts'
import type { PaintedWire } from '../../../../../vitest.config.ts'

describe('the painter in the page', () => {
  it('paints each oracle frame to the same bytes as Node', async () => {
    const wired = (commands as unknown as { paintedCells: () => Promise<PaintedWire[]> }).paintedCells
    const cells = await wired()
    expect(cells.length).toBe(4)
    for (const { id, input, hash } of cells)
      expect(await cellHash(paintCell(fromWire<CellInput>(input))), id).toBe(hash)
  }, 120_000)
})
