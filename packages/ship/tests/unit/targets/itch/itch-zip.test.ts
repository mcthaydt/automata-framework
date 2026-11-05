import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildFiles } from '../../prepare/build-files.ts'
import { writeDeterministicZip } from './itch-zip.ts'

function build(files: Record<string, string | Uint8Array>): string {
  const distDir = mkdtempSync(join(tmpdir(), 'ship-itch-zip-'))
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(distDir, path)), { recursive: true })
    writeFileSync(join(distDir, path), contents)
  }
  return distDir
}

// yauzl (Ruken's zip reader, already a ship dependency) ships no types; this is the part the test uses.
interface ZipEntry {
  readonly fileName: string
  readonly lastModFileDate: number
  readonly lastModFileTime: number
}
interface ZipFile {
  on(event: 'entry', listener: (entry: ZipEntry) => void): void
  on(event: 'end', listener: () => void): void
  readEntry(): void
  openReadStream(entry: ZipEntry, callback: (error: Error | null, stream: Readable) => void): void
}
const yauzl = createRequire(import.meta.url)('yauzl') as {
  open(
    path: string,
    options: { lazyEntries: boolean },
    callback: (error: Error | null, zip: ZipFile) => void,
  ): void
}

interface Unpacked {
  readonly name: string
  readonly dosDate: number
  readonly dosTime: number
  readonly bytes: Buffer
}

/** Reads every entry back with yauzl, Ruken's own zip reader. */
function unpack(path: string): Promise<Unpacked[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error)
      const entries: Unpacked[] = []
      zip.on('entry', (entry) => {
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError)
          const chunks: Buffer[] = []
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => {
            entries.push({
              name: entry.fileName,
              dosDate: entry.lastModFileDate,
              dosTime: entry.lastModFileTime,
              bytes: Buffer.concat(chunks),
            })
            zip.readEntry()
          })
        })
      })
      zip.on('end', () => resolve(entries))
      zip.readEntry()
    })
  })
}

const files = {
  'index.html': '<script type="module" src="./build/app.js"></script>',
  'build/app.js': 'console.log("hi");\n'.repeat(200),
  'assets/noise.bin': new Uint8Array(Array.from({ length: 256 }, (_, index) => (index * 7919) % 256)),
  'assets/b-c.png': 'png',
  'a-b/c.txt': 'é',
}

describe('writeDeterministicZip', () => {
  it('gives the same bytes when the same build is zipped twice', () => {
    const distDir = build(files)
    const out = mkdtempSync(join(tmpdir(), 'ship-itch-zip-out-'))
    writeDeterministicZip(join(out, 'one.zip'), distDir, buildFiles(distDir))
    writeDeterministicZip(join(out, 'two.zip'), distDir, buildFiles(distDir))
    expect(readFileSync(join(out, 'one.zip')).equals(readFileSync(join(out, 'two.zip')))).toBe(true)
  })

  it('gives the same bytes for the same files written at different times and in a different order', () => {
    const first = build(files)
    const second = build(Object.fromEntries(Object.entries(files).reverse()))
    const out = mkdtempSync(join(tmpdir(), 'ship-itch-zip-out-'))
    writeDeterministicZip(join(out, 'one.zip'), first, buildFiles(first))
    writeDeterministicZip(join(out, 'two.zip'), second, [...buildFiles(second)].reverse())
    expect(readFileSync(join(out, 'one.zip')).equals(readFileSync(join(out, 'two.zip')))).toBe(true)
  })

  it('unpacks to the same files, sorted by path, all dated 1980-01-01 00:00', async () => {
    const distDir = build(files)
    const path = join(mkdtempSync(join(tmpdir(), 'ship-itch-zip-out-')), 'game.zip')
    writeDeterministicZip(path, distDir, buildFiles(distDir))
    const entries = await unpack(path)
    expect(entries.map((entry) => entry.name)).toEqual([
      'a-b/c.txt',
      'assets/b-c.png',
      'assets/noise.bin',
      'build/app.js',
      'index.html',
    ])
    for (const entry of entries) {
      expect(entry.bytes.equals(readFileSync(join(distDir, entry.name))), entry.name).toBe(true)
      expect(entry.dosDate).toBe((0 << 9) | (1 << 5) | 1)
      expect(entry.dosTime).toBe(0)
    }
  })
})
