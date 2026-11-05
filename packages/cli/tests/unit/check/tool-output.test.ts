import { describe, expect, it } from 'vitest'
import { parseBoundaries, parseTsc, parseVitestJson } from '#src/check/tool-output.ts'

describe('tool output parsers', () => {
  it('reads check-boundaries lines and ignores its summary', () => {
    const out = [
      'src/sim/move.system.ts:1:1  import  import of "effect" is not allowed in the sim',
      'src/sim/tick.system.ts:12:5  banned-global  "Date" is not allowed in the sim',
      'check-boundaries: 9 files, 2 findings',
    ].join('\n')
    expect(parseBoundaries(out)).toEqual([
      {
        file: 'src/sim/move.system.ts',
        line: 1,
        col: 1,
        rule: 'import',
        message: 'import of "effect" is not allowed in the sim',
      },
      {
        file: 'src/sim/tick.system.ts',
        line: 12,
        col: 5,
        rule: 'banned-global',
        message: '"Date" is not allowed in the sim',
      },
    ])
  })

  it('reads tsc errors, with and without a file', () => {
    const out = [
      "src/main.ts(4,7): error TS2322: Type 'string' is not assignable to type 'number'.",
      '  continuation line of the message',
      "error TS5083: Cannot read file '/x/tsconfig.json'.",
    ].join('\n')
    expect(parseTsc(out)).toEqual([
      {
        file: 'src/main.ts',
        line: 4,
        col: 7,
        rule: 'TS2322',
        message: "Type 'string' is not assignable to type 'number'.\n  continuation line of the message",
      },
      { file: '', line: 0, col: 0, rule: 'TS5083', message: "Cannot read file '/x/tsconfig.json'." },
    ])
  })

  it('reads failed tests and failed files from vitest’s JSON report', () => {
    const report = {
      numFailedTests: 1,
      testResults: [
        {
          name: '/game/src/sim/game.golden.test.ts',
          status: 'failed',
          message: '',
          assertionResults: [
            {
              fullName: 'golden matches',
              status: 'failed',
              location: { line: 9, column: 3 },
              failureMessages: ['AssertionError: expected 1 to be 2\n    at stack'],
            },
            { fullName: 'other', status: 'passed', location: { line: 20, column: 3 }, failureMessages: [] },
          ],
        },
        {
          name: '/game/src/broken.test.ts',
          status: 'failed',
          message: 'Cannot find module ./gone.ts',
          assertionResults: [],
        },
        { name: '/game/src/ok.test.ts', status: 'passed', message: '', assertionResults: [] },
      ],
    }
    expect(parseVitestJson(JSON.stringify(report), '/game')).toEqual([
      {
        file: 'src/sim/game.golden.test.ts',
        line: 9,
        col: 3,
        rule: 'test',
        message: 'golden matches: AssertionError: expected 1 to be 2',
      },
      {
        file: 'src/broken.test.ts',
        line: 0,
        col: 0,
        rule: 'test-file',
        message: 'Cannot find module ./gone.ts',
      },
    ])
  })
})
