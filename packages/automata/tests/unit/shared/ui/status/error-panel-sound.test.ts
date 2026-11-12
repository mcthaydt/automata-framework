import { render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installUiSounds } from '#src/features/audio/ui-sounds.ts'
import ErrorPanel from '#src/shared/ui/status/ErrorPanel.svelte'

// Audit T3: the `error` name was declared and promised, and nothing asked for it. The panel asks when it appears.

let root: HTMLElement
let played: string[]
let remove: (() => void) | undefined

beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
  played = []
  remove = installUiSounds(
    root,
    { sound: (alias: string) => void played.push(alias) },
    { error: 'error.wav' },
    () => 0,
  )
})
afterEach(() => {
  remove?.()
  root.remove()
})

describe('ErrorPanel interface sound', () => {
  it('asks for the error sound once when it appears', () => {
    render(ErrorPanel, {
      target: root,
      props: {
        code: 'download',
        message: "Couldn't download the game.",
        actions: [{ id: 'retry', label: 'Try again', kind: 'primary', onSelect: vi.fn() }],
      },
    })
    expect(played).toEqual(['error.wav'])
  })
})
