// A generator gains options; it does not change what existing data draws. The painted skirt gained `ease` (cut.test.ts), and a skirt that
// names none draws as it did before: the figure builder's base pair in a cream tee and each skirt, eight views at density 2, each cell's
// SHA-1 (first 12 hex digits) recorded from the commit before the option (`4b59511a`).
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/shared/figures/door.ts'
import { paintedStand } from '#src/testing/painted-cell.ts'

vi.setConfig({ testTimeout: 60_000 })

const SKIRTS: Readonly<
  Record<string, { skirt: object; cells: Readonly<Record<string, readonly string[]>> }>
> = {
  'a flared skirt': {
    skirt: { skirt: 'denim', length: 0.42, flare: 0.3 },
    cells: {
      'base-m': [
        '40419e73d39d',
        '9588c39e958a',
        'f0fc3ce80e52',
        '84ee4858e46f',
        'cd8b764d2820',
        '3c68c25d2cf1',
        '65b5e2d0c64e',
        'e2cde38b993a',
      ],
      'base-f': [
        '3a7090c59906',
        'f2803bbbe36a',
        'e4928e45cba5',
        '17c0bbd20aae',
        '9070d7ca68cb',
        'babf0eb3e261',
        '1c27a8ef8385',
        '88e8225842ae',
      ],
    },
  },
  'a long plain skirt': {
    skirt: { skirt: 'denim', length: 0.6 },
    cells: {
      'base-m': [
        '367d56fd706d',
        'c2cd2aac8bbe',
        'c9bafdec3740',
        '0dc647d9c0c9',
        '67f690cbe292',
        '00727f404fb3',
        '0769a4ae83d7',
        'fbc1457991ed',
      ],
      'base-f': [
        'e4e84d70d130',
        '538f6b54087b',
        'a698742d856d',
        'b487e97817ec',
        'a4b115de6545',
        '79510f73cd1f',
        'fa71c93a425d',
        '59d99a5c3afb',
      ],
    },
  },
}

describe('a skirt that names no ease', () => {
  for (const [name, { skirt, cells }] of Object.entries(SKIRTS))
    for (const member of BASE) {
      it(`draws ${name} on ${member.def.id} in eight views as it did before the option`, () => {
        const def = {
          ...member.def,
          default: 'worn',
          outfits: { worn: [{ tee: 'ribCream', sleeves: 'short' }, skirt, { eyes: 'eyeBrown' }] },
        } as typeof member.def
        const got = paintedStand(def, 2).map((cell) =>
          createHash('sha1').update(cell.painted).digest('hex').slice(0, 12),
        )
        expect(got).toEqual(cells[member.def.id])
      })
    }
})
