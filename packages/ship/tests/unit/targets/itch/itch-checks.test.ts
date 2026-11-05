import { mkdirSync, mkdtempSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildFiles } from '../../prepare/build-files.ts'
import {
  checkFileCount,
  checkFileSizes,
  checkItchEntry,
  checkNoRukenToml,
  checkPathLengths,
  findCaseMismatches,
} from './itch-checks.ts'
import { ITCH_LIMITS } from './itch-limits.ts'

/** A build folder with these files, and the listing the checks read. */
function build(files: Record<string, string>): { distDir: string; files: readonly string[] } {
  const distDir = mkdtempSync(join(tmpdir(), 'ship-itch-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(distDir, path)), { recursive: true })
    writeFileSync(join(distDir, path), text)
  }
  return { distDir, files: buildFiles(distDir) }
}

describe('itch.io limits', () => {
  it('are the documented ones, with where and when they were read', async () => {
    const { ITCH_LIMITS_SOURCE } = await import('./itch-limits.ts')
    expect(ITCH_LIMITS).toEqual({
      maxFiles: 1000,
      maxPathLength: 240,
      maxFileBytes: 200_000_000,
      maxTotalBytes: 500_000_000,
    })
    expect(ITCH_LIMITS_SOURCE).toEqual({ url: 'https://itch.io/docs/creators/html5', read: '2026-10-16' })
  })
})

describe('checkItchEntry', () => {
  it('passes a build with index.html at its root', () => {
    expect(checkItchEntry(build({ 'index.html': '' }).files, 'index.html')).toEqual([])
  })

  it('fails a build without index.html at its root', () => {
    expect(checkItchEntry(build({ 'game/index.html': '', 'Index.html': '' }).files, 'index.html')).toEqual([
      'index.html: not at the root of the build; itch.io opens index.html',
    ])
  })

  it('fails a different game.entry, saying itch.io needs index.html', () => {
    expect(checkItchEntry(build({ 'index.html': '', 'play.html': '' }).files, 'play.html')).toEqual([
      'game.entry is play.html, but itch.io opens index.html; name the entry page index.html for an itch build',
    ])
  })
})

describe('checkFileCount', () => {
  it('passes 1,000 files and fails 1,001, naming the build and the limit', () => {
    const many = Array.from({ length: 1001 }, (_, index) => `f${index}.txt`)
    expect(checkFileCount(many.slice(0, 1000))).toEqual([])
    expect(checkFileCount(many)).toEqual(['the build has 1001 files; itch.io allows at most 1000'])
  })
})

describe('checkPathLengths', () => {
  it('passes a 240-character path and fails a 241-character one, naming it and the limit', () => {
    const path = (length: number) => `assets/${'a'.repeat(length - 'assets/'.length - '.png'.length)}.png`
    expect(checkPathLengths([path(240)])).toEqual([])
    expect(checkPathLengths([path(241), 'index.html'])).toEqual([
      `${path(241)}: 241 characters; itch.io allows paths of at most 240`,
    ])
  })
})

describe('checkFileSizes', () => {
  it('fails a file over 200 MB, naming it and the limit', () => {
    const { distDir, files } = build({ 'index.html': '', 'assets/big.bin': '' })
    truncateSync(join(distDir, 'assets/big.bin'), ITCH_LIMITS.maxFileBytes + 1) // sparse: no disk used
    expect(checkFileSizes(distDir, files)).toEqual([
      'assets/big.bin: 200000001 bytes; itch.io allows at most 200000000 bytes (200 MB) per file',
    ])
  })

  it('fails a build over 500 MB in total, naming the limit', () => {
    const { distDir, files } = build({ 'a.bin': '', 'b.bin': '', 'c.bin': '' })
    for (const file of files) truncateSync(join(distDir, file), ITCH_LIMITS.maxFileBytes)
    expect(checkFileSizes(distDir, files)).toEqual([
      'the build is 600000000 bytes; itch.io allows at most 500000000 bytes (500 MB) in total',
    ])
  })

  it('passes a small build', () => {
    const { distDir, files } = build({ 'index.html': '<p>hi</p>' })
    expect(checkFileSizes(distDir, files)).toEqual([])
  })
})

describe('findCaseMismatches', () => {
  const art = { 'assets/hero.png': 'png', 'fonts/Title.woff2': 'font' }

  it('passes references that match the files exactly, and ignores names that are not files', () => {
    const { distDir, files } = build({
      ...art,
      'index.html': '<img src="assets/hero.png"><a href="https://example.com/Assets/Hero.png">x</a>',
      'build/app.css': '@font-face { src: url(../fonts/Title.woff2) }',
      'build/app.js': 'fetch("./assets/hero.png?v=2"); const label = "Hero"; const api = "/health"',
    })
    expect(findCaseMismatches(distDir, files)).toEqual([])
  })

  it('fails a page, a stylesheet, a script and a JSON file that name a file in the wrong case', () => {
    const { distDir, files } = build({
      ...art,
      'index.html': '<img src="assets/Hero.png">',
      'build/app.css': '@font-face { src: url("../fonts/title.woff2") }',
      'build/app.js': 'new Audio("assets/HERO.png")',
      'assets/sheet.json': '{"meta":{"image":"Hero.png"}}',
    })
    expect(findCaseMismatches(distDir, files)).toEqual([
      'assets/sheet.json: "Hero.png" is assets/hero.png on disk; itch.io matches file names case-sensitively',
      'build/app.css: "../fonts/title.woff2" is fonts/Title.woff2 on disk; itch.io matches file names case-sensitively',
      'build/app.js: "assets/HERO.png" is assets/hero.png on disk; itch.io matches file names case-sensitively',
      'index.html: "assets/Hero.png" is assets/hero.png on disk; itch.io matches file names case-sensitively',
    ])
  })
})

describe('checkNoRukenToml', () => {
  it('fails a build that still carries ruken.toml', () => {
    expect(checkNoRukenToml(['index.html'])).toEqual([])
    expect(checkNoRukenToml(['index.html', 'ruken.toml'])).toEqual([
      'ruken.toml: a Ruken manifest is in the build (left by `automata-ship prepare`); remove it or rebuild for itch.io',
    ])
  })
})
