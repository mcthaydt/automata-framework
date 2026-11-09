import { describe, expect, it } from 'vitest'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import { createProfileRegistry } from '#src/shared/level-2d/profiles/profile.ts'
import { readDocument } from '#src/shared/level-2d/profiles/read-document.ts'
import { noteText, plantedProfile } from '#src/testing/level-2d/planted-profile.ts'
import { minimalProjectFile } from '#src/testing/level-2d/projects.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

// Reading a file: one of six outcomes, always a value. The level project is read through the app's
// registry; the two-profile cases plant a second profile.

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const MEGABYTE = 1024 * 1024

function bothProfiles() {
  const registry = createAppProfiles()
  registry.register(plantedProfile({ sniff: () => true }))
  return registry
}

describe('readDocument: a file one profile claims', () => {
  it('parses a working file with the profile that sniffs it', () => {
    const text = printProject(mossgate())
    const outcome = readDocument(createAppProfiles(), 'mossgate.af2d.json', encode(text))
    expect(outcome.status).toBe('parsed')
    if (outcome.status !== 'parsed') return
    expect(outcome.profile.label).toBe('Level project')
    expect(printProject(outcome.value as Project)).toBe(text)
    expect(outcome.text).toBe(text)
  })

  it('claims a file by what is in it when the name says nothing', () => {
    const text = printProject(mossgate())
    expect(readDocument(createAppProfiles(), 'download (1)', encode(text)).status).toBe('parsed')
  })

  it('keeps the text and the profile when the profile cannot parse it, with the position', () => {
    const text = '{\n  "format": "af2d",\n  oops\n}'
    const outcome = readDocument(createAppProfiles(), 'broken.af2d.json', encode(text))
    expect(outcome.status).toBe('invalid')
    if (outcome.status !== 'invalid') return
    expect(outcome.profile.label).toBe('Level project')
    expect(outcome.text).toBe(text)
    expect(outcome.errors[0]).toMatchObject({ code: 'notJson', line: 3, column: 3 })
  })

  it('reports a file from a newer editor as invalid, with the profile’s own code', () => {
    const file = { ...minimalProjectFile(), version: 99 }
    const outcome = readDocument(createAppProfiles(), 'new.af2d.json', encode(JSON.stringify(file)))
    expect(outcome.status).toBe('invalid')
    if (outcome.status !== 'invalid') return
    expect(outcome.errors.map((error) => error.code)).toEqual(['newerVersion'])
  })

  it('reports an unknown key with its path', () => {
    const file = { ...minimalProjectFile(), surprise: 1 }
    const outcome = readDocument(createAppProfiles(), 'odd.af2d.json', encode(JSON.stringify(file)))
    expect(outcome.status).toBe('invalid')
    if (outcome.status !== 'invalid') return
    expect(outcome.errors).toEqual([expect.objectContaining({ code: 'unknownKeys', path: 'surprise' })])
  })
})

describe('readDocument: a file nobody claims, or whose bytes are no text', () => {
  it('says unrecognised, with the text for a text view', () => {
    const outcome = readDocument(createAppProfiles(), 'readme.txt', encode('hello'))
    expect(outcome).toEqual({ status: 'unrecognised', text: 'hello' })
  })

  it('says notText for bytes that are not UTF-8, and never guesses an encoding', () => {
    const outcome = readDocument(
      createAppProfiles(),
      'mossgate.af2d.json',
      new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]),
    )
    expect(outcome).toEqual({ status: 'notText' })
  })

  it('reads past a byte order mark instead of failing on it', () => {
    const text = printProject(mossgate())
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(text)])
    const outcome = readDocument(createAppProfiles(), 'mossgate.af2d.json', bytes)
    expect(outcome.status).toBe('parsed')
    if (outcome.status === 'parsed') expect(outcome.text).toBe(text)
  })

  it('refuses a file over 16 MB before it is decoded', () => {
    const bytes = new Uint8Array(16 * MEGABYTE + 1).fill(0xff)
    expect(readDocument(createAppProfiles(), 'huge.af2d.json', bytes)).toEqual({
      status: 'tooLarge',
      bytes: 16 * MEGABYTE + 1,
    })
  })

  it('reads a file of exactly 16 MB', () => {
    const bytes = new Uint8Array(16 * MEGABYTE).fill(0x20)
    expect(readDocument(createAppProfiles(), 'edge.af2d.json', bytes).status).toBe('invalid')
  })
})

describe('readDocument: two profiles claim the file', () => {
  it('asks which one, in registration order, and keeps the text', () => {
    const outcome = readDocument(bothProfiles(), 'mossgate.af2d.json', encode(printProject(mossgate())))
    expect(outcome.status).toBe('choose')
    if (outcome.status !== 'choose') return
    expect(outcome.candidates.map((profile) => profile.label)).toEqual(['Level project', 'Planted note'])
    expect(outcome.text).toBe(printProject(mossgate()))
  })

  it('opens it with the profile that was chosen', () => {
    const outcome = readDocument(bothProfiles(), 'hello.note', encode(noteText('hi')), 'planted')
    expect(outcome.status).toBe('parsed')
    if (outcome.status === 'parsed') expect(outcome.value).toEqual({ text: 'hi' })
  })

  it('treats a chosen profile that does not claim the file as unrecognised', () => {
    const registry = createProfileRegistry()
    registry.register(plantedProfile())
    expect(readDocument(registry, 'a.note', encode(noteText('x')), 'level-project').status).toBe(
      'unrecognised',
    )
  })

  it('is not asked to choose when only one profile claims the file', () => {
    const registry = createAppProfiles()
    registry.register(plantedProfile())
    expect(readDocument(registry, 'a.note', encode(noteText('x'))).status).toBe('parsed')
  })
})
