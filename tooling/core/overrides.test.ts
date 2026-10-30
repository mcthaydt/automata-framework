import { describe, expect, it } from 'vitest'
import { BEGIN, END, parsePacks, writeOverrides } from './overrides.ts'

// Test 2 (PRODUCT.5e): pnpm-workspace.yaml's core overrides are generated from the packs.json that the framework's
// core-packs tool writes (P5-D1), sorted, and nothing outside the two marker lines changes. The packs.json checks
// below are the mutation survivors the first build left (the plan's "As built so far"): each field and shape is
// rejected on its own, so a check that is weakened or dropped fails a test.

const COMMIT = 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b'
const SHA = 'a'.repeat(64)

function pack(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const folder = name.replace(/^@[^/]+\//, '')
  return { name, version: '0.1.0', file: `mcthaydt-${folder}-0.1.0.tgz`, sha256: SHA, dir: folder, ...extra }
}

const text = (value: unknown): string => JSON.stringify(value)
const packsJson = (packs: unknown[], sourceCommit: unknown = COMMIT): string => text({ sourceCommit, packs })

const WORKSPACE = [
  'packages:',
  '  - packages/*',
  'saveExact: true',
  '# A note above the block.',
  BEGIN,
  END,
  '# A note below the block.',
  '',
].join('\n')

describe('parsePacks', () => {
  it('reads the source commit and every pack', () => {
    const parsed = parsePacks(packsJson([pack('@mcthaydt/automata-sim'), pack('@mcthaydt/evidence')]))
    expect(parsed.sourceCommit).toBe(COMMIT)
    expect(parsed.packs.map((entry) => entry.dir)).toEqual(['automata-sim', 'evidence'])
  })

  it('accepts a pre-release version', () => {
    expect(() =>
      parsePacks(packsJson([pack('@mcthaydt/automata-sim', { version: '1.0.0-beta.2' })])),
    ).not.toThrow()
  })

  it('rejects text that is not JSON', () => {
    expect(() => parsePacks('{')).toThrow('packs.json is not JSON')
  })

  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"packs"'],
  ])('rejects %s at the top', (_case, json) => {
    expect(() => parsePacks(json)).toThrow('packs.json must be an object with sourceCommit and packs')
  })

  it.each([
    ['a dirty build', `${COMMIT}+dirty`],
    ['anything after the commit', `${COMMIT}x`],
    ['anything before the commit', `x${COMMIT}`],
    ['a short hash', COMMIT.slice(0, 12)],
    ['upper-case hex', COMMIT.toUpperCase()],
    ['a number', 42],
  ])('rejects %s as the source commit', (_case, sourceCommit) => {
    expect(() => parsePacks(packsJson([pack('@mcthaydt/automata-sim')], sourceCommit))).toThrow(
      `packs.json sourceCommit must be one clean commit (40 lower-case hex characters); found ${JSON.stringify(sourceCommit)}`,
    )
  })

  it.each([
    ['missing', undefined],
    ['an object', { 0: pack('@mcthaydt/automata-sim') }],
    ['empty', []],
  ])('rejects packs that are %s', (_case, packs) => {
    expect(() => parsePacks(text({ sourceCommit: COMMIT, packs }))).toThrow('packs.json lists no packs')
  })

  it.each([
    ['a string', 'automata-sim'],
    ['null', null],
    ['an array', [pack('@mcthaydt/automata-sim')]],
  ])('rejects a pack that is %s', (_case, entry) => {
    expect(() => parsePacks(packsJson([entry]))).toThrow('packs.json pack 0 is not an object')
  })

  it.each([
    ['name', ''],
    ['name', 'automata-sim'],
    ['name', '@mcthaydt/'],
    ['name', '@mcthaydt/automata sim'],
    ['name', "@mcthaydt/it's"],
    ['name', 'npm:@mcthaydt/automata-sim'],
    ['name', 7],
    ['version', ''],
    ['version', '1.0'],
    ['version', 'latest'],
    ['version', 'v0.1.0'],
    ['version', '^0.1.0'],
    ['version', '0.1.0 || 0.2.0'],
    ['version', 1],
    ['file', ''],
    ['file', 'automata-sim-0.1.0.tar'],
    ['file', 'automata-sim-0.1.0.tgz.part'],
    ['file', '../automata-sim-0.1.0.tgz'],
    ['file', null],
    ['sha256', ''],
    ['sha256', 'a'.repeat(63)],
    ['sha256', 'a'.repeat(65)],
    ['sha256', 'A'.repeat(64)],
    ['dir', ''],
    ['dir', '.'],
    ['dir', '..'],
    ['dir', '.hidden'],
    ['dir', '-flag'],
    ['dir', '_private'],
    ['dir', 'a/b'],
    ['dir', 'Automata-Sim'],
    ['dir', 3],
    ['dir', undefined],
  ])('rejects a pack whose %s is %j and names the pack and the field', (field, value) => {
    const entry = pack('@mcthaydt/automata-sim', { [field]: value })
    expect(() => parsePacks(packsJson([pack('@mcthaydt/automata-content'), entry]))).toThrow(
      `packs.json pack 1 has a bad ${field}: ${JSON.stringify(value)}`,
    )
  })

  it('accepts the folder names the framework writes (letters, digits, dots, hyphens and underscores after the first)', () => {
    for (const dir of ['automata-sim', 'evidence', 'a', '9lives', 'a.b_c-d']) {
      expect(() => parsePacks(packsJson([pack('@mcthaydt/automata-sim', { dir })])), dir).not.toThrow()
    }
  })

  it('rejects one name packed twice', () => {
    expect(() =>
      parsePacks(
        packsJson([pack('@mcthaydt/automata-sim'), pack('@mcthaydt/automata-sim', { dir: 'sim-2' })]),
      ),
    ).toThrow('packs.json lists @mcthaydt/automata-sim twice')
  })

  it('rejects one folder used by two packs', () => {
    expect(() =>
      parsePacks(
        packsJson([pack('@mcthaydt/automata-sim'), pack('@mcthaydt/other', { dir: 'automata-sim' })]),
      ),
    ).toThrow('packs.json unpacks @mcthaydt/automata-sim and @mcthaydt/other into one folder, automata-sim')
  })
})

describe('writeOverrides', () => {
  const packs = parsePacks(
    packsJson([
      pack('@mcthaydt/automata-ui'),
      pack('@mcthaydt/automata-content'),
      pack('@mcthaydt/evidence'),
    ]),
  )

  it('writes one file: override per pack, sorted by name, between the markers', () => {
    const written = writeOverrides(WORKSPACE, packs, new Set())
    const begin = written.indexOf(BEGIN)
    const end = written.indexOf(END)
    expect(written.slice(begin, end + END.length)).toBe(
      [
        BEGIN,
        `# Written by \`pnpm core:sync\` from .core/packs/packs.json (framework commit ${COMMIT}).`,
        'overrides:',
        "  '@mcthaydt/automata-content': file:.core/packs/automata-content",
        "  '@mcthaydt/automata-ui': file:.core/packs/automata-ui",
        "  '@mcthaydt/evidence': file:.core/packs/evidence",
        END,
      ].join('\n'),
    )
  })

  // localeCompare puts a_b before a-b; code point order puts a-b first on every machine.
  it('sorts by code point, not by locale', () => {
    const mixed = parsePacks(packsJson([pack('@mcthaydt/a_b'), pack('@mcthaydt/a-b')]))
    const written = writeOverrides(WORKSPACE, mixed, new Set())
    expect(written.indexOf("'@mcthaydt/a-b'")).toBeLessThan(written.indexOf("'@mcthaydt/a_b'"))
  })

  it('never overrides a package Plus has itself', () => {
    const written = writeOverrides(WORKSPACE, packs, new Set(['@mcthaydt/automata-ui']))
    expect(written).not.toContain('automata-ui')
    expect(written).toContain("'@mcthaydt/automata-content'")
  })

  it('writes an empty map when Plus has every packed name itself', () => {
    const written = writeOverrides(WORKSPACE, packs, new Set(packs.packs.map((entry) => entry.name)))
    expect(written).toContain(`overrides: {}\n${END}`)
  })

  it('keeps every line outside the markers', () => {
    const written = writeOverrides(WORKSPACE, packs, new Set())
    const outside = (yaml: string) => {
      const lines = yaml.split('\n')
      return [...lines.slice(0, lines.indexOf(BEGIN)), ...lines.slice(lines.indexOf(END) + 1)]
    }
    expect(outside(written)).toEqual(outside(WORKSPACE))
  })

  it('is idempotent', () => {
    const once = writeOverrides(WORKSPACE, packs, new Set())
    expect(writeOverrides(once, packs, new Set())).toBe(once)
  })

  it('replaces an earlier block rather than adding to it', () => {
    const earlier = writeOverrides(WORKSPACE, packs, new Set())
    const fewer = parsePacks(packsJson([pack('@mcthaydt/automata-sim')]))
    const written = writeOverrides(earlier, fewer, new Set())
    expect(written).not.toContain('automata-ui')
    expect(written).toContain("'@mcthaydt/automata-sim': file:.core/packs/automata-sim")
  })

  it.each([
    ['the begin marker', WORKSPACE.replace(`${BEGIN}\n`, ''), `pnpm-workspace.yaml has no "${BEGIN}" line`],
    ['the end marker', WORKSPACE.replace(`${END}\n`, ''), `pnpm-workspace.yaml has no "${END}" line`],
  ])('fails without %s and says which', (_case, yaml, message) => {
    expect(() => writeOverrides(yaml, packs, new Set())).toThrow(message)
  })

  it('fails when a marker appears twice', () => {
    expect(() => writeOverrides(`${WORKSPACE}${BEGIN}\n`, packs, new Set())).toThrow(
      `pnpm-workspace.yaml has 2 "${BEGIN}" lines; it needs exactly one`,
    )
    expect(() => writeOverrides(`${WORKSPACE}${END}\n`, packs, new Set())).toThrow(
      `pnpm-workspace.yaml has 2 "${END}" lines; it needs exactly one`,
    )
  })

  it('fails when the end marker comes first', () => {
    const swapped = WORKSPACE.replace(BEGIN, '@@').replace(END, BEGIN).replace('@@', END)
    expect(() => writeOverrides(swapped, packs, new Set())).toThrow(
      `pnpm-workspace.yaml has "${END}" before "${BEGIN}"`,
    )
  })

  it('matches a marker only as a whole line', () => {
    const indented = WORKSPACE.replace(`${BEGIN}\n`, `  ${BEGIN}\n`)
    expect(() => writeOverrides(indented, packs, new Set())).toThrow(
      `pnpm-workspace.yaml has no "${BEGIN}" line`,
    )
  })
})
