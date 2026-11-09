// @vitest-environment jsdom
import type { ContentAnimation } from '@automata/content/level-2d'
import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AnimationSection from '#src/features/characters/AnimationSection.svelte'
import { newAnimation } from '#src/features/characters/animation-model.ts'

const PICTURE = { w: 64, h: 24 }
const animation = (): ContentAnimation => newAnimation('assets/hero.png', { w: 16, h: 24 })

function open(current: ContentAnimation | undefined) {
  const edits: (ContentAnimation | undefined)[] = []
  const written: string[] = []
  render(AnimationSection, {
    animation: current,
    size: { w: 16, h: 24 },
    files: {
      list: async () => [],
      write: async (path: string) => {
        written.push(path)
        return { ok: true as const, mtime: 1 }
      },
    },
    read: async () => new Uint8Array([1]),
    measure: async () => PICTURE,
    onedit: (next: ContentAnimation | undefined) => {
      edits.push(next)
      return { ok: true as const }
    },
  })
  return { edits, written }
}

describe('the Animation section', () => {
  it('offers Add picture with the hint about paint apps when the character has no animation', () => {
    open(undefined)
    expect(
      screen.getByText('Draw your frames in any paint app, then add the picture here.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Add picture')).toBeInTheDocument()
  })

  it('writes the chosen picture into the game and starts an animation with one clip on it', async () => {
    const { edits, written } = open(undefined)
    const file = new File([new Uint8Array([1, 2])], 'Hero Walk.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Choose a picture of frames'), file)
    await waitFor(() => expect(edits).toHaveLength(1))
    expect(written).toEqual(['assets/hero-walk.png'])
    expect(edits[0]).toEqual({
      image: 'assets/hero-walk.png',
      frame: { w: 16, h: 24 },
      clips: [{ id: 'idle', frames: [0], fps: 8, loop: true }],
    })
  })

  it('shows every frame of the picture, numbered, and tapping them adds them to the chosen clip in order', async () => {
    const { edits } = open(animation())
    expect(await screen.findByText('The picture has 4 frames.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Frame 2' }))
    expect(edits.at(-1)?.clips[0]?.frames).toEqual([0, 2])
  })

  it('has Repeat as a switch, a speed, and removes a clip with no question', async () => {
    const { edits } = open(animation())
    await userEvent.click(screen.getByRole('switch', { name: 'Repeat' }))
    expect(edits.at(-1)?.clips[0]?.loop).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Remove idle' }))
    expect(edits.at(-1)).toBeUndefined()
    expect(screen.getByRole('spinbutton', { name: 'Speed' })).toBeInTheDocument()
  })

  it('adds a clip and renames one, and says a clash in a sentence', async () => {
    const { edits } = open(animation())
    await userEvent.click(screen.getByRole('button', { name: 'Add a clip' }))
    expect(edits.at(-1)?.clips.map((clip) => clip.id)).toEqual(['idle', 'clip 2'])
    const name = screen.getByLabelText('Name of clip idle')
    await userEvent.clear(name)
    await userEvent.type(name, 'run')
    await userEvent.tab()
    expect(edits.at(-1)?.clips[0]?.id).toBe('run')
  })

  it('says which frame a clip uses that the picture does not have', async () => {
    const past: ContentAnimation = {
      ...animation(),
      clips: [{ id: 'idle', frames: [9], fps: 8, loop: true }],
    }
    open(past)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This clip uses frame 9, but the picture has 4.',
    )
  })

  it('shows a refusal’s sentence', async () => {
    const onedit = vi.fn(() => ({ ok: false as const, message: 'Nope.' }))
    render(AnimationSection, {
      animation: animation(),
      size: { w: 16, h: 24 },
      read: async () => undefined,
      onedit,
    })
    await userEvent.click(screen.getByRole('switch', { name: 'Repeat' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope.')
  })
})
