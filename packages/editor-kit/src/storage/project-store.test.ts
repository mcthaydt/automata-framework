import { describe, expect, test } from 'vitest'
import { domError } from '../testing/fake-fs'
import { classifyStorageError, StorageError } from './project-store'

describe('classifyStorageError', () => {
  test('a full disk or quota is quota', () => {
    expect(classifyStorageError(domError('QuotaExceededError', 'The quota has been exceeded.'))).toEqual({
      reason: 'quota',
      message: 'The quota has been exceeded.',
    })
  })

  test.each(['NotAllowedError', 'SecurityError'])('%s is denied', (name) => {
    expect(classifyStorageError(domError(name, 'No.')).reason).toBe('denied')
  })

  test.each(['InvalidStateError', 'NoModificationAllowedError', 'TypeMismatchError', 'AbortError'])(
    '%s is io, with its message kept',
    (name) => {
      expect(classifyStorageError(domError(name, 'It broke.'))).toEqual({
        reason: 'io',
        message: 'It broke.',
      })
    },
  )

  test('a plain Error is io', () => {
    expect(classifyStorageError(new Error('boom'))).toEqual({ reason: 'io', message: 'boom' })
  })

  test('something that is not an error is io, described', () => {
    expect(classifyStorageError('nope')).toEqual({ reason: 'io', message: 'nope' })
    expect(classifyStorageError(undefined).reason).toBe('io')
  })

  test('a StorageError keeps the reason it already has', () => {
    expect(classifyStorageError(new StorageError('quota', 'full'))).toEqual({
      reason: 'quota',
      message: 'full',
    })
  })
})
