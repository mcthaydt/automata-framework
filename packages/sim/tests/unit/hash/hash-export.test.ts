// The `./hash` subpath lets the content compiler hash with the sim's own XXH64 and canonical JSON
// without importing the sim (master spec §9). Imported by package name to prove the export resolves.
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { expect, test } from 'vitest'
import { canonicalJson as rootCanonicalJson, xxhash64 as rootXxhash64 } from '#src/index.ts'

test('the ./hash subpath exports the same functions as the package root', () => {
  expect(canonicalJson).toBe(rootCanonicalJson)
  expect(xxhash64).toBe(rootXxhash64)
})

test('hashing canonical JSON through ./hash gives a 16-digit hex id', () => {
  const id = hex64(xxhash64(utf8(canonicalJson({ b: 1, a: 2 }))))
  expect(id).toMatch(/^[0-9a-f]{16}$/)
})
