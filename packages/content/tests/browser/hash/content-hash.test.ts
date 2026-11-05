// The content hash must be the same in every engine the game runs in, because the runtime and the sim
// compare it at boot and on restore. The compiler runs in Node; this pins one hash in Node, Chromium,
// WebKit and Firefox.
import { expect, test } from 'vitest'
import { contentHash } from '#src/hash/content-hash.ts'

test('a fixed content value hashes to the same id in every engine', () => {
  const data = {
    palette: { colors: ['#ff0040', '#131313'], name: 'Endesga 64' },
    tuning: { GRAVITY: -275.5, LIVES: 3 },
    text: 'Café ☕',
  }
  expect(contentHash(data)).toBe('277afcf17068dfb7')
})
