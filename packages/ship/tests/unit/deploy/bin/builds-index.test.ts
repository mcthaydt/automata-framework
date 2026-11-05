import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildsIndex } from './builds-index.ts'

function root(builds: Record<string, object>, live?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-index-'))
  for (const [id, build] of Object.entries(builds)) {
    mkdirSync(join(dir, 'builds', id), { recursive: true })
    writeFileSync(join(dir, 'builds', id, 'build.json'), JSON.stringify(build))
  }
  mkdirSync(join(dir, 'builds', '.incoming.abc'), { recursive: true }) // a half-installed build is not listed
  if (live !== undefined) writeFileSync(join(dir, 'live'), `${live}\n`)
  return dir
}

describe('buildsIndex', () => {
  it('lists builds newest first with their link, tag, branch and which one is live', () => {
    const dir = root(
      {
        '202610100900-aaaaaaa': {
          buildId: '202610100900-aaaaaaa',
          commit: 'aaaaaaa',
          tag: 'v0.1.0',
          branch: null,
        },
        '202610111205-bbbbbbb': {
          buildId: '202610111205-bbbbbbb',
          commit: 'bbbbbbb',
          tag: null,
          branch: 'main',
        },
      },
      '202610100900-aaaaaaa',
    )
    expect(buildsIndex(dir, 'https://af-dev.example.org', 10)).toEqual([
      {
        buildId: '202610111205-bbbbbbb',
        url: 'https://af-dev.example.org/builds/202610111205-bbbbbbb/',
        commit: 'bbbbbbb',
        tag: null,
        branch: 'main',
        live: false,
      },
      {
        buildId: '202610100900-aaaaaaa',
        url: 'https://af-dev.example.org/builds/202610100900-aaaaaaa/',
        commit: 'aaaaaaa',
        tag: 'v0.1.0',
        branch: null,
        live: true,
      },
    ])
  })

  it('keeps only the newest `limit` builds', () => {
    const builds: Record<string, object> = {}
    for (let minute = 10; minute < 25; minute++) {
      const id = `2026101112${minute}-abcdef0`
      builds[id] = { buildId: id, commit: 'abcdef0', tag: null, branch: 'main' }
    }
    const listed = buildsIndex(root(builds), 'https://x', 10).map((build) => build.buildId)
    expect(listed).toHaveLength(10)
    expect(listed[0]).toBe('202610111224-abcdef0')
  })

  it('still lists the live build when it is older than the newest `limit`', () => {
    const builds: Record<string, object> = {}
    for (let minute = 10; minute < 22; minute++) {
      const id = `2026101112${minute}-abcdef0`
      builds[id] = { buildId: id, commit: 'abcdef0', tag: null, branch: 'main' }
    }
    const listed = buildsIndex(root(builds, '202610111210-abcdef0'), 'https://x', 10)
    expect(listed).toHaveLength(11)
    expect(listed.at(-1)).toMatchObject({ buildId: '202610111210-abcdef0', live: true })
  })
})
