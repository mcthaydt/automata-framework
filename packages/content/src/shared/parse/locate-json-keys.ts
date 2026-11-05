// Where each top-level key of a JSON object is, so a translation's diagnostic can say `file:line:col`.
//
// `JSON.parse` returns values only. This scanner runs over text `JSON.parse` has already accepted, so it never
// decides whether the JSON is valid: it tracks strings (with their escapes) and nesting depth, and records a
// string as a key when it sits directly inside the outer object and a `:` follows it. A byte order mark is
// skipped without taking a column, as the TOML side does.

import type { KeyIndex, KeyPosition } from './locate-keys'

export function locateJsonKeys(text: string): KeyIndex {
  const index = new Map<string, KeyPosition>()
  let line = 1
  let lineStart = text.startsWith('﻿') ? 1 : 0
  let depth = 0
  let i = lineStart
  while (i < text.length) {
    const char = text[i]
    if (char === '\n') {
      line++
      lineStart = i + 1
      i++
      continue
    }
    if (char === '"') {
      const start = i
      i++
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
      const literal = text.slice(start, i + 1)
      i++
      if (depth !== 1) continue
      let next = i
      while (/\s/.test(text[next] ?? '')) next++
      if (text[next] !== ':') continue
      const key = JSON.parse(literal) as string
      if (!index.has(key)) index.set(key, { line, column: start - lineStart + 1 })
      continue
    }
    if (char === '{' || char === '[') depth++
    if (char === '}' || char === ']') depth--
    i++
  }
  return index
}
