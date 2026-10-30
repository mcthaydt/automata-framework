import { describe, expect, it } from 'vitest'
import * as node from './index'

describe('@mcthaydt/automata-editor-suite/node', () => {
  it('exports the change set, the checks runner, the gates reader, Ask and the argv runner', () => {
    expect(Object.keys(node).sort()).toEqual([
      'OUTPUT_CAP',
      'createArgvChecks',
      'createClaudeAsk',
      'createGatesReader',
      'createGitChangeSet',
      'runArgv',
    ])
  })
})
