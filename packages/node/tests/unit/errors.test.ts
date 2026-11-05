import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { FileError, ProcessError } from './errors.ts'

// The errors are typed through `TaggedErrorClass` so the package builds with isolatedDeclarations (M2.4 spec §2).
// These pin what callers rely on: the tag, the fields, the message, `instanceof` and `Effect.catchTag`.
describe('node errors', () => {
  it('FileError keeps its tag, fields and message, and is caught by tag', () => {
    const error = new FileError({ path: '/a.txt', cause: new Error('denied') })
    expect(error._tag).toBe('FileError')
    expect(error.path).toBe('/a.txt')
    expect(error.message).toBe('/a.txt: denied')
    expect(error).toBeInstanceOf(FileError)
    expect(error).toBeInstanceOf(Error)
    const caught = Effect.runSync(
      Effect.catchTag(Effect.fail(error), 'FileError', (failure) => Effect.succeed(failure.path)),
    )
    expect(caught).toBe('/a.txt')
  })

  it('ProcessError keeps its tag, fields and message, and is caught by tag', () => {
    const error = new ProcessError({ command: 'git', cause: 'ENOENT' })
    expect(error._tag).toBe('ProcessError')
    expect(error.command).toBe('git')
    expect(error.message).toBe('could not run git: ENOENT')
    expect(error).toBeInstanceOf(ProcessError)
    const caught = Effect.runSync(
      Effect.catchTag(Effect.fail(error), 'ProcessError', (failure) => Effect.succeed(failure.command)),
    )
    expect(caught).toBe('git')
  })
})
