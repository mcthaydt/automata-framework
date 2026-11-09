import { describe, expect, it } from 'vitest'
import { type Header, type HeaderError, parseHeader } from '#src/header.ts'

const full = `// core-input-keys: move a square with the keyboard
//
// Shows: keys() turns keys into one sim command per tick;
//   rect() draws an entity, interpolated.
// Controls: arrows or WASD
// Packages: @automata/framework, @automata/physics/2d
// Difficulty: ★★☆☆
// Tier: core
// Host: grant=saves,storage; saves=best:12.5,lives:3; offline
// Golden: 120
// Pending: DX.2
import { keys } from '@automata/framework'
`

const errors = (source: string): HeaderError[] => {
  const result = parseHeader(source)
  if (!Array.isArray(result)) throw new Error('expected errors')
  return result
}

describe('parseHeader', () => {
  it('reads every field', () => {
    expect(parseHeader(full)).toEqual<Header>({
      name: 'core-input-keys',
      title: 'move a square with the keyboard',
      shows: 'keys() turns keys into one sim command per tick; rect() draws an entity, interpolated.',
      controls: 'arrows or WASD',
      packages: ['@automata/framework', '@automata/physics/2d'],
      difficulty: 2,
      tier: 'core',
      host: { grant: ['saves', 'storage'], saves: { best: '12.5', lives: '3' }, offline: true },
      golden: 120,
      pending: 'DX.2',
      lines: 11,
    })
  })

  it('leaves the optional fields out when they are absent', () => {
    const minimal = full
      .split('\n')
      .filter((line) => !/^\/\/ (Host|Golden|Pending):/.test(line))
      .join('\n')
    const header = parseHeader(minimal) as Header
    expect(header.host).toBeUndefined()
    expect(header.golden).toBeUndefined()
    expect(header.pending).toBeUndefined()
  })

  it('names a missing required field and the line the header ends on', () => {
    const source = full.replace(/^\/\/ Shows:.*\n\/\/ {3}rect.*\n/m, '')
    expect(errors(source)).toEqual([{ line: 9, field: 'Shows', message: 'Shows: is required' }])
  })

  it('rejects a difficulty outside one to four stars, on its line', () => {
    expect(errors(full.replace('★★☆☆', '★★★★★'))).toEqual([
      {
        line: 7,
        field: 'Difficulty',
        message: 'Difficulty: must be four of ★/☆ with 1–4 filled, got "★★★★★"',
      },
    ])
  })

  it('rejects an unknown tier, a bad golden and an unknown field', () => {
    const source = full.replace('Tier: core', 'Tier: gold').replace('Golden: 120', 'Golden: soon')
    const withBase = source.replace('// Pending: DX.2', '// Pending: DX.2\n// Base: emberwick')
    expect(errors(withBase).map((error) => error.field)).toEqual(['Tier', 'Golden', 'Base'])
  })

  it('needs a title line naming the example', () => {
    expect(errors(full.replace('// core-input-keys: move', '// move'))[0]).toMatchObject({
      line: 1,
      field: 'title',
    })
  })
})
