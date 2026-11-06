import { describe, expect, it, vi } from 'vitest'
import type { LevelThumbnails } from '../../shared/level-2d/canvas/level-thumbnails'
import { mossgate } from '../../testing/level-2d/samples'
import { lazyThumbnails } from './lazy-thumbnails'

// Home's thumbnails behind a dynamic import (ED2D.4c3b review): Pixi loads with the first card that has a preview,
// not with the editor.

const preview = { project: mossgate(), level: 'moss-steps' }

function real() {
  const thumbnail = vi.fn(async (key: string) => `url:${key}`)
  const dispose = vi.fn()
  const made: LevelThumbnails = { thumbnail, dispose }
  return { made, thumbnail, dispose }
}

describe('lazyThumbnails', () => {
  it('loads nothing until the first thumbnail, then loads once and answers through it', async () => {
    const { made, thumbnail } = real()
    const load = vi.fn(async () => made)
    const lazy = lazyThumbnails(load)
    expect(load).not.toHaveBeenCalled()
    expect(await Promise.all([lazy.thumbnail('a', preview), lazy.thumbnail('b', preview)])).toEqual([
      'url:a',
      'url:b',
    ])
    expect(load).toHaveBeenCalledOnce()
    expect(thumbnail).toHaveBeenCalledWith('a', preview)
  })

  it('answers undefined when the module cannot be loaded', async () => {
    const lazy = lazyThumbnails(async () => {
      throw new Error('offline')
    })
    expect(await lazy.thumbnail('a', preview)).toBeUndefined()
  })

  it('disposes what it loaded, never loads after dispose, and disposes a load that lands late', async () => {
    const { made, dispose } = real()
    const never = vi.fn(async () => made)
    const unused = lazyThumbnails(never)
    unused.dispose()
    expect(await unused.thumbnail('a', preview)).toBeUndefined()
    expect(never).not.toHaveBeenCalled()

    let land: (value: LevelThumbnails) => void = () => undefined
    const late = lazyThumbnails(() => new Promise((resolve) => (land = resolve)))
    const answer = late.thumbnail('a', preview)
    late.dispose()
    land(made)
    expect(await answer).toBeUndefined()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
