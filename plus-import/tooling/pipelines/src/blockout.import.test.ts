import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expand } from '@mcthaydt/automata-sector-format/blockout'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, it } from 'vitest'
import { validateBlockout } from './blockout.checks.ts'
import { generateContent } from './blockout.generate.ts'
import { importBlockout } from './blockout.import.ts'
import { importFolder } from './blockout.import-cli.ts'
import { TOY } from './testing/toy-blockout.ts'

// `import` (M6 spec §4.11, BP-D3): an existing `sector-map` and `nav-graph` as a blockout spec, once. The map becomes the rooms (walls and
// portals as written), the graph the hand-written nav; what the files cannot know (the spawn, boxes, zones beyond the first, anchors) is
// listed as to do.

const generated = generateContent(TOY, `${JSON.stringify(TOY)}\n`)
const map = parse(generated.map) as never
const nav = parse(generated.nav) as never

describe('importBlockout', () => {
  it('turns a map and a graph into a blockout that validates and expands to the same sectors', () => {
    const { blockout } = importBlockout('toy', map, nav)
    expect(validateBlockout(blockout)).toEqual([])
    expect(JSON.parse(JSON.stringify(expand(blockout).sectors))).toEqual(
      JSON.parse(JSON.stringify(expand(TOY).sectors)),
    )
  })

  it('writes the graph by hand (nothing derived) and keeps its nodes and edges', () => {
    const { blockout } = importBlockout('toy', map, nav)
    expect(blockout.nav.derive).toBe(false)
    expect(blockout.nav.nodes).toEqual((nav as { nodes: unknown }).nodes)
    expect((blockout.nav.edges ?? []).length).toBe((nav as { edges: unknown[] }).edges.length)
  })

  it('puts the spawn in the first room and the one zone it can name, and lists what it could not know', () => {
    const { blockout, todo } = importBlockout('toy', map, nav)
    const first = blockout.rooms[0] as unknown as { corners: [number, number][] }
    const xs = first.corners.map((c) => c[0])
    expect(blockout.spawn.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 5)
    expect(blockout.zones.map((z) => z.id)).toEqual([blockout.rooms[0]?.zone])
    expect(todo.join('\n')).toMatch(/spawn.*zones.*boxes/s)
  })

  it('keeps masses', () => {
    const withMass = { ...(map as object), masses: [{ id: 'm', x: 1, z: 1, w: 1, d: 1, h: 1 }] } as never
    expect(importBlockout('toy', withMass, nav).blockout.masses).toHaveLength(1)
  })
})

const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('importFolder', () => {
  it('writes the folder’s blockout from its map and graph, and refuses to overwrite without force', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blockout-import-'))
    temps.push(dir)
    writeFileSync(
      join(dir, 'blockout.pipe.toml'),
      'blockout = "blockout.json"\nmap = "toy.map.toml"\nnav = "toy.nav.toml"\n',
    )
    writeFileSync(join(dir, 'toy.map.toml'), generated.map)
    writeFileSync(join(dir, 'toy.nav.toml'), generated.nav)
    const first = await importFolder(dir, { force: false })
    expect(first.exit).toBe(0)
    expect(existsSync(join(dir, 'blockout.json'))).toBe(true)
    expect(validateBlockout(JSON.parse(readFileSync(join(dir, 'blockout.json'), 'utf8')))).toEqual([])
    const again = await importFolder(dir, { force: false })
    expect(again.exit).toBe(4)
    expect(again.message).toMatch(/--force/)
    expect((await importFolder(dir, { force: true })).exit).toBe(0)
  })

  it('fails, naming the file, when the map or the graph is missing or does not load', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'blockout-import-'))
    temps.push(dir)
    writeFileSync(
      join(dir, 'blockout.pipe.toml'),
      'blockout = "blockout.json"\nmap = "nope.toml"\nnav = "toy.nav.toml"\n',
    )
    writeFileSync(join(dir, 'toy.nav.toml'), generated.nav)
    const result = await importFolder(dir, { force: false })
    expect(result.exit).toBe(1)
    expect(result.message).toContain('nope.toml')
    writeFileSync(join(dir, 'nope.toml'), 'sectors = 3\n')
    expect((await importFolder(dir, { force: false })).message).toContain('nope.toml')
  })
})
