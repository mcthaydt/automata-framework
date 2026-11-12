import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installUiSounds } from '#src/features/audio/ui-sounds.ts'
import Modal from '#src/shared/ui/dialog/Modal.svelte'

// Audit T3: `open` and `close` were names the framework declared and a template promised, and nothing asked for them.
// A Modal asks when it shows and when it goes, so a game that maps the names hears its panels open and close.

let root: HTMLElement
let played: string[]
let remove: (() => void) | undefined
let component: ReturnType<typeof mount> | undefined

const audio = { sound: (alias: string) => void played.push(alias) }
const body = createRawSnippet(() => ({ render: () => '<p>Credits</p>' }))

beforeEach(() => {
  root = document.createElement('div')
  document.body.append(root)
  played = []
  remove = installUiSounds(root, audio, { open: 'open.wav', close: 'close.wav' }, () => 0)
})
afterEach(() => {
  remove?.()
  if (component !== undefined) unmount(component)
  component = undefined
  root.remove()
})

/** A parent that stays when the Modal goes, as a screen's own markup does. */
function show() {
  const host = document.createElement('div')
  root.append(host)
  component = mount(Modal, {
    target: host,
    props: { title: 'Credits', closeLabel: 'Close', onclose: () => {}, children: body },
  })
  flushSync()
}

describe('Modal interface sounds', () => {
  it('asks for the open sound when it shows', () => {
    show()
    expect(played).toEqual(['open.wav'])
  })

  it('asks for the close sound when it goes', () => {
    show()
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    flushSync()
    expect(played).toEqual(['open.wav', 'close.wav'])
  })

  it('plays nothing where the game maps neither name', () => {
    remove?.()
    played = []
    remove = installUiSounds(root, audio, { press: 'press.wav' }, () => 0)
    show()
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    expect(played).toEqual([])
  })
})
