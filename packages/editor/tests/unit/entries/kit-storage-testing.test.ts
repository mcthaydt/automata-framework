import { describe, expect, test } from 'vitest'
import { createMemoryStore } from '#src/entries/kit-storage.ts'
import { describeProjectStore } from '#src/entries/kit-storage-testing.ts'

// A host's own store runs the same contract the kit's adapters do, so the entry must hand the suite over.
describeProjectStore('memory, through the entry', () => createMemoryStore())

describe('the kit storage testing entry', () => {
  test('exports the contract suite', () => {
    expect(typeof describeProjectStore).toBe('function')
  })
})
