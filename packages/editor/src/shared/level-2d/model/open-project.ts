import type { z } from 'zod'
import { findJsonError } from './json-syntax'
import { FILE_VERSION, MIGRATIONS, type Migration, migrate, type RawFile } from './migrations/migration'
import { projectFileSchema } from './project.schema'
import type { OpenIssue } from './project-checks'
import { decodeProject } from './project-codec'
import type { Project } from './project-types'

// Opening a working file. There are three outcomes and no fourth: the file opens, or it
// opens read-only because writing it back could lose something, or it fails with a reason the error panel can show.

/** A file is at most this many characters (the spec's 16 MB; a character is at least a byte, so this never refuses a smaller file). */
export const MAX_FILE_CHARS: number = 16 * 1024 * 1024

/** An error panel shows a page of problems, not a hundred thousand. */
const MAX_ISSUES = 100

export type OpenResult =
  | {
      readonly status: 'opened'
      readonly project: Project
      /** The version the file had, when migrations upgraded it in memory; the file changes only on save. */
      readonly upgradedFrom?: number | undefined
    }
  | {
      /** No `project`: with nothing to print, nothing can be written back over the file (G-o, G-p). */
      readonly status: 'readOnly'
      readonly reason: 'newerVersion' | 'unknownKeys'
      readonly message: string
      /** The file as read, for the text view and for exporting it as it is. */
      readonly text: string
      /** `unknownKeys`: where each unknown key is, in alphabetical order. */
      readonly keyPaths?: readonly string[] | undefined
    }
  | {
      readonly status: 'failed'
      readonly code: 'notJson' | 'notAProject' | 'invalid' | 'tooLarge'
      readonly message: string
      /** `notJson`: where the text stops being JSON, from 1. */
      readonly line?: number | undefined
      readonly column?: number | undefined
      readonly issues?: readonly OpenIssue[] | undefined
    }

type Failed = Extract<OpenResult, { status: 'failed' }>

const fail = (code: Failed['code'], message: string, rest: Partial<Failed> = {}): OpenResult => ({
  status: 'failed',
  code,
  message,
  ...rest,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A zod path as the spec writes paths (`levels[moss-steps].layers[collision].rows[3]`): an array element that has an
 * `id`, or a `def` for a layer, is addressed by it, any other by its index.
 */
function pathText(root: unknown, path: readonly PropertyKey[]): string {
  let node: unknown = root
  let text = ''
  for (const key of path) {
    const child: unknown =
      isRecord(node) || Array.isArray(node) ? (node as Record<PropertyKey, unknown>)[key] : undefined
    if (typeof key === 'number') {
      const name = isRecord(child) ? (child.id ?? child.def) : undefined
      text += `[${typeof name === 'string' ? name : key}]`
    } else {
      text += text === '' ? String(key) : `.${String(key)}`
    }
    node = child
  }
  return text
}

type SchemaIssue = z.core.$ZodIssue

function schemaFailure(raw: unknown, text: string, issues: readonly SchemaIssue[]): OpenResult {
  const unknownKeys = issues.length > 0 && issues.every((issue) => issue.code === 'unrecognized_keys')
  if (unknownKeys) {
    const keyPaths: string[] = []
    for (const issue of issues) {
      if (issue.code !== 'unrecognized_keys') continue
      for (const key of issue.keys) keyPaths.push(pathText(raw, [...issue.path, key]))
    }
    keyPaths.sort()
    const noun = keyPaths.length === 1 ? 'key' : 'keys'
    return {
      status: 'readOnly',
      reason: 'unknownKeys',
      message: `This file has ${keyPaths.length} ${noun} this editor does not know (${keyPaths.slice(0, 5).join(', ')}${keyPaths.length > 5 ? ', …' : ''}). It opens read-only so that saving cannot lose them.`,
      text,
      keyPaths,
    }
  }
  const shown: OpenIssue[] = issues
    .slice(0, MAX_ISSUES)
    .map((issue) => ({ code: issue.code, path: pathText(raw, issue.path), message: issue.message }))
  return fail(
    'invalid',
    `This file is not a valid project: ${issues.length} problem${issues.length === 1 ? '' : 's'}.`,
    {
      issues: shown,
    },
  )
}

/**
 * Reads the text of a `*.af2d.json`. Migrations (the real chain unless a test passes its own) upgrade an older file in
 * memory. Throws only for a malformed migration chain, which is a bug in the editor and not in the file.
 */
export function openProject(text: string, migrations: readonly Migration[] = MIGRATIONS): OpenResult {
  if (text.length > MAX_FILE_CHARS) {
    return fail('tooLarge', 'This file is over 16 MB, which is more than the editor opens.')
  }
  // A byte order mark is not JSON; some tools write one.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch (error) {
    const where = findJsonError(source)
    const reason = where?.message ?? (error instanceof Error ? error.message : 'invalid JSON')
    const position = where ? ` at line ${where.line}, column ${where.column}` : ''
    return fail('notJson', `This file is not valid JSON${position}: ${reason}.`, {
      line: where?.line,
      column: where?.column,
    })
  }
  if (!isRecord(raw))
    return fail('notAProject', 'This is JSON, but not a project: the top level is not an object.')
  if (raw.format !== 'af2d') {
    return fail(
      'notAProject',
      `This is JSON, but not a project: its format is ${JSON.stringify(raw.format)}, not "af2d".`,
    )
  }
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return fail('invalid', 'The file has no whole-number version.', {
      issues: [{ code: 'badVersion', path: 'version', message: 'the version must be a whole number' }],
    })
  }
  if (version > FILE_VERSION) {
    return {
      status: 'readOnly',
      reason: 'newerVersion',
      message: `This project was made by a newer editor (file version ${version}; this editor reads up to version ${FILE_VERSION}). It opens read-only and is never rewritten.`,
      text,
    }
  }
  let file: RawFile = raw
  if (version < FILE_VERSION) {
    const migrated = migrate(raw, version, FILE_VERSION, migrations)
    if (!migrated.ok)
      return fail(
        'invalid',
        `This project is from an older editor and cannot be upgraded: ${migrated.message}.`,
      )
    file = migrated.raw
  }
  const parsed = projectFileSchema.safeParse(file)
  if (!parsed.success) return schemaFailure(file, text, parsed.error.issues)
  const decoded = decodeProject(parsed.data)
  if (!decoded.ok) {
    const n = decoded.issues.length
    return fail('invalid', `This file is not a valid project: ${n} problem${n === 1 ? '' : 's'}.`, {
      issues: decoded.issues.slice(0, MAX_ISSUES),
    })
  }
  return {
    status: 'opened',
    project: decoded.project,
    upgradedFrom: version < FILE_VERSION ? version : undefined,
  }
}
