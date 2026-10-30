import { describe, expect, it } from 'vitest'
import { exampleLocation } from './stack-location.ts'

const FILE = 'examples/shapes/shapes-rects.ts'
const BLOB = 'blob:http://127.0.0.1:5800/6f1c2a90-1b7e-4d4e-9d1f-3a2b1c0d9e8f'

describe('exampleLocation', () => {
  it("finds the first frame in the example's file in a V8 stack, by its sourceURL", () => {
    const stack = [
      'Error: x',
      '    at step (http://127.0.0.1:5800/playground/runtime/automata-LRkvFZ12.js:1:20412)',
      `    at Object.run (${FILE}:21:18)`,
      `    at setup (${FILE}:40:3)`,
    ].join('\n')
    expect(exampleLocation(stack, FILE)).toEqual({ line: 21, column: 18 })
  })

  it('reads a V8 frame with no function name', () => {
    expect(exampleLocation(`Error: x\n    at ${FILE}:9:1`, FILE)).toEqual({ line: 9, column: 1 })
  })

  it('finds the Blob module frame in a JavaScriptCore or Gecko stack', () => {
    const stack = [
      'step@http://127.0.0.1:5800/playground/runtime/automata-LRkvFZ12.js:1:20412',
      `run@${BLOB}:21:18`,
      `@${BLOB}:3:1`,
    ].join('\n')
    expect(exampleLocation(stack, FILE)).toEqual({ line: 21, column: 18 })
  })

  it('reads a V8 frame in the Blob module', () => {
    expect(exampleLocation(`Error: x\n    at run (${BLOB}:5:7)`, FILE)).toEqual({ line: 5, column: 7 })
  })

  it('finds nothing when no frame is in the example', () => {
    const stack =
      'Error: x\n    at step (http://127.0.0.1:5800/playground/runtime/automata-LRkvFZ12.js:1:20412)'
    expect(exampleLocation(stack, FILE)).toBeUndefined()
    expect(exampleLocation('', FILE)).toBeUndefined()
    expect(
      exampleLocation(`Error: x\n    at other (examples/shapes/shapes-rects.tsx:2:2)`, FILE),
    ).toBeUndefined()
  })
})
