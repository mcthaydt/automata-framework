// Reading a file into a level (ED3D.5b step 1; ED3D spec §5.3 flow 1, §11): the profile the registry picks parses it,
// or the person is told which of the other things is the case, with the installed profiles named.
import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, readLevel } from '#src/features/levels-3d/document/read-level.ts'
import { AUTHORED_NAMES, loadAuthored } from '#src/testing/fixtures.ts'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const INSTALLED = ['af-sector']

describe('readLevel', () => {
  it('parses the depot with the af-sector profile and no warnings', () => {
    const read = readLevel(bytes(loadAuthored(AUTHORED_NAMES[0])))
    expect(read.status).toBe('parsed')
    if (read.status !== 'parsed') return
    expect(read.profile.id).toBe('af-sector')
    expect(read.text).toBe(loadAuthored('depot.af-sector'))
    expect(read.warnings).toEqual([])
  })

  it('opens a newer minor version with the codec’s warning', () => {
    const text = loadAuthored('depot.af-sector').replace('"af-sector/1"', '"af-sector/1.4"')
    const read = readLevel(bytes(text))
    expect(read.status).toBe('parsed')
    if (read.status !== 'parsed') return
    expect(read.warnings.map((warning) => warning.path)).toEqual([['format']])
  })

  it('refuses a newer major version, naming the format found and the installed profiles', () => {
    const text = loadAuthored('depot.af-sector').replace('"af-sector/1"', '"af-sector/2"')
    const read = readLevel(bytes(text))
    expect(read.status).toBe('invalid')
    if (read.status !== 'invalid') return
    expect(read.profile.id).toBe('af-sector')
    expect(read.issues).toEqual([
      { path: ['format'], message: 'af-sector/2 is not a version this editor reads (af-sector/1)' },
    ])
    expect(read.installed).toEqual(INSTALLED)
    expect(read.text).toBe(text)
  })

  it('lists a schema error with its JSON path', () => {
    const text = loadAuthored('depot.af-sector').replace('"floor": 0', '"floor": "low"')
    const read = readLevel(bytes(text))
    expect(read.status === 'invalid' && read.issues[0]?.path).toEqual(['sectors', 0, 'floor'])
  })

  it('does not open a file no profile recognises, and names the installed profiles', () => {
    const read = readLevel(bytes('{"format": "other/1"}'))
    expect(read).toEqual({
      status: 'unrecognised',
      reason: 'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/)',
      installed: INSTALLED,
      message:
        'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/). Installed profiles: af-sector.',
      text: '{"format": "other/1"}',
    })
  })

  it('says where the text stops being JSON', () => {
    const read = readLevel(bytes('{ "scene": }'))
    expect(read.status === 'unrecognised' && read.reason).toMatch(/^not JSON: .*at \d+/)
  })

  it('does not decode bytes that are not UTF-8', () => {
    expect(readLevel(new Uint8Array([0xff, 0xfe, 0x7b]))).toEqual({ status: 'notText' })
  })

  it('refuses a file over 16 MB before decoding it', () => {
    // Bytes that would not decode: the size is judged first.
    const big = new Uint8Array(MAX_FILE_BYTES + 1).fill(0xff)
    expect(readLevel(big)).toEqual({ status: 'tooLarge', bytes: MAX_FILE_BYTES + 1 })
    expect(MAX_FILE_BYTES).toBe(16 * 1024 * 1024)
  })
})
