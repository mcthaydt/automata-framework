import { describe, expect, it } from 'vitest'
import type { Migration } from '#src/shared/level-2d/model/migrations/migration.ts'
import { MAX_FILE_CHARS, type OpenResult, openProject } from '#src/shared/level-2d/model/open-project.ts'
import { decodeProject, printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { edited as editedFile, type Path } from '#src/testing/level-2d/edit-file.ts'
import { minimalProjectFile, richProjectFile } from '#src/testing/level-2d/projects.ts'

function edited(
  parent: Path,
  key: string | number,
  value: unknown,
  file: unknown = richProjectFile(),
): unknown {
  return editedFile(parent, key, value, file)
}

const textOf = (file: unknown): string => JSON.stringify(file, null, 2)

function canonicalText(): string {
  const result = decodeProject(richProjectFile())
  if (!result.ok) throw new Error('the rich fixture should decode')
  return printProject(result.project)
}

function failure(result: OpenResult) {
  if (result.status !== 'failed') throw new Error(`expected a failure, got ${result.status}`)
  return result
}

function readOnly(result: OpenResult) {
  if (result.status !== 'readOnly') throw new Error(`expected read-only, got ${result.status}`)
  return result
}

describe('openProject', () => {
  it('opens a canonical file, and G-b: printing it again changes nothing', () => {
    const text = canonicalText()
    const result = openProject(text)
    if (result.status !== 'opened') throw new Error(`expected opened, got ${result.status}`)
    expect(result.upgradedFrom).toBeUndefined()
    expect(printProject(result.project)).toBe(text)
  })

  it('opens the smallest file', () => {
    expect(openProject(textOf(minimalProjectFile())).status).toBe('opened')
  })

  it('reads a file that starts with a byte order mark, and prints it without', () => {
    const result = openProject(`﻿${canonicalText()}`)
    if (result.status !== 'opened') throw new Error(`expected opened, got ${result.status}`)
    expect(printProject(result.project)).toBe(canonicalText())
  })

  describe('G-n: not a project', () => {
    it('text that is not JSON fails at the line and column of the first error', () => {
      const result = failure(openProject('{\n  "format": af2d\n}'))
      expect(result).toMatchObject({ code: 'notJson', line: 2, column: 13 })
      expect(result.message).toMatch(/line 2, column 13/)
    })

    it('empty text is not JSON', () => {
      expect(failure(openProject(''))).toMatchObject({ code: 'notJson', line: 1, column: 1 })
    })

    it('JSON with another format fails and says which', () => {
      const result = failure(openProject('{"format":"ldtk","version":1}'))
      expect(result.code).toBe('notAProject')
      expect(result.message).toMatch(/ldtk/)
    })

    it('JSON that is not an object fails', () => {
      for (const text of ['[]', '3', 'null', '"af2d"']) {
        expect(failure(openProject(text)).code, text).toBe('notAProject')
      }
    })

    it('a version that is not a whole number is an invalid file', () => {
      for (const version of [undefined, 'one', 1.5, null]) {
        const result = failure(openProject(textOf(edited([], 'version', version))))
        expect(result, String(version)).toMatchObject({ code: 'invalid', issues: [{ path: 'version' }] })
      }
    })
  })

  describe('G-o: a newer version', () => {
    it('opens read-only with the raw text, and builds no project to write back', () => {
      const text = textOf(edited([], 'version', 2))
      const result = readOnly(openProject(text))
      expect(result).toMatchObject({ reason: 'newerVersion', text })
      expect(result.message).toMatch(/newer editor/)
      expect(result.message).toMatch(/version 2/)
      expect('project' in result).toBe(false)
    })

    it('does not read a newer file beyond its version, so keys it has never heard of are fine', () => {
      const text = '{"format":"af2d","version":9,"future":{"shape":[1,2]}}'
      expect(readOnly(openProject(text))).toMatchObject({ reason: 'newerVersion', text })
    })
  })

  describe('G-p: a key this editor does not know', () => {
    it('opens read-only and lists the path of each key, at any depth', () => {
      let file = edited(['levels', 1], 'comment', 'hi')
      file = edited(['defs', 'layers', 3], 'blend', 'add', file)
      file = edited(['levels', 1, 'layers', 0, 'items', 0], 'tint', 1, file)
      const text = textOf(file)
      const result = readOnly(openProject(text))
      expect(result).toMatchObject({ reason: 'unknownKeys', text })
      expect(result.keyPaths).toEqual([
        'defs.layers[decor].blend',
        'levels[start].comment',
        'levels[start].layers[entities].items[00000009].tint',
      ])
      expect(result.message).toMatch(/3 keys/)
      expect('project' in result).toBe(false)
    })

    it('names the key of an unknown key inside a pattern cell', () => {
      const rule = ['defs', 'layers', 2, 'groups', 0, 'rules', 0, 'pattern']
      const result = readOnly(openProject(textOf(edited(rule, 4, { is: 1, extra: 2 }))))
      expect(result.keyPaths).toEqual([
        'defs.layers[ground-art].groups[fill].rules[solid-top].pattern[4].extra',
      ])
    })

    it('a key at the top of the file counts too', () => {
      const result = readOnly(openProject(textOf(edited([], 'author', 'me'))))
      expect(result.keyPaths).toEqual(['author'])
    })

    it('is a plain failure when the file also has a real error, which is the one to fix first', () => {
      const file = edited(['levels', 1, 'size'], 'w', 0, edited(['levels', 1], 'comment', 'hi'))
      const result = failure(openProject(textOf(file)))
      expect(result.code).toBe('invalid')
      expect(result.issues?.map((issue) => issue.path)).toContain('levels[start].size.w')
    })
  })

  describe('a file that is the right version but wrong', () => {
    it('fails with the schema issues, addressed by id', () => {
      const result = failure(openProject(textOf(edited(['levels', 0, 'size'], 'w', 0))))
      expect(result.code).toBe('invalid')
      expect(result.issues).toMatchObject([{ path: 'levels[cellar].size.w' }])
    })

    it('fails with the decode issues: a repeated id', () => {
      const result = failure(openProject(textOf(edited(['levels', 1], 'id', 'cellar'))))
      expect(result.issues).toMatchObject([{ code: 'duplicateId', path: 'levels[1]' }])
    })

    it('reports at most the first 100 issues, so a ruined file does not flood the panel', () => {
      const levels = Array.from({ length: 150 }, (_, index) => ({
        ...richProjectFile().levels[0],
        id: `level-${index}`,
        size: { w: 0, h: 0 },
      }))
      const result = failure(openProject(textOf(edited([], 'levels', levels))))
      expect(result.issues).toHaveLength(100)
    })
  })

  describe('an older version', () => {
    const upgrade: Migration = {
      from: 0,
      to: 1,
      run: (raw) => ({ ...raw, name: `Upgraded ${String(raw.name)}` }),
    }
    const old = textOf(edited([], 'version', 0))

    it('runs the migrations in memory and says which version it came from', () => {
      const result = openProject(old, [upgrade])
      if (result.status !== 'opened') throw new Error(`expected opened, got ${result.status}`)
      expect(result).toMatchObject({ upgradedFrom: 0, project: { version: 1, name: 'Upgraded Mossgate' } })
    })

    it('fails, naming the version, when no migration reaches it', () => {
      const result = failure(openProject(old))
      expect(result.code).toBe('invalid')
      expect(result.message).toMatch(/no migration from version 0/)
    })

    it('fails when the migration breaks the file, with the schema issues of the result', () => {
      const breaks: Migration = { from: 0, to: 1, run: (raw) => ({ ...raw, worlds: [] }) }
      const result = failure(openProject(old, [breaks]))
      expect(result).toMatchObject({ code: 'invalid', issues: [{ path: 'worlds' }] })
    })

    it('fails when the migration throws', () => {
      const throws: Migration = {
        from: 0,
        to: 1,
        run: () => {
          throw new Error('boom')
        },
      }
      expect(failure(openProject(old, [throws])).message).toMatch(/boom/)
    })

    it('refuses a malformed chain by throwing: it is a bug in the editor, not in the file', () => {
      const jump: Migration = { from: 0, to: 5, run: (raw) => raw }
      expect(() => openProject(old, [jump])).toThrow(/advance by one/)
    })
  })

  describe('size', () => {
    it('refuses a file over 16 MB before reading it', () => {
      const result = failure(openProject('x'.repeat(MAX_FILE_CHARS + 1)))
      expect(result.code).toBe('tooLarge')
      expect(result.message).toMatch(/16 MB/)
    })

    it('reads a file at exactly the limit as far as JSON: this one is just not JSON', () => {
      expect(failure(openProject('x'.repeat(MAX_FILE_CHARS))).code).toBe('notJson')
    })
  })
})
