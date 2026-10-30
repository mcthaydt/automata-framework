import '@mcthaydt/automata-editor-kit/tokens.css'
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { drawView, richProject } from '../../testing/draw-fixtures'
import { withDefs } from '../../testing/project-edit'
import LevelCanvas from './LevelCanvas.svelte'

// The canvas component (ED2D.4c3b, plan decisions 5 and 8; spec §13) in Chromium: it loads the level's images from the
// workspace, draws, and says "Preview paused" while the WebGL context is lost.

afterEach(() => cleanup())

function project() {
  // The rich fixture's tileset, now with an image that the store does not have, and a level background that it has.
  return withDefs(richProject(), (defs) => ({
    ...defs,
    tilesets: defs.tilesets.map((set) => ({ ...set, image: 'assets/terrain.png' })),
  }))
}

function mountCanvas(reads: string[], level = 'start') {
  const result = render(LevelCanvas, {
    props: {
      project: project(),
      view: drawView({ level }),
      read: async (path: string) => {
        reads.push(path)
        return undefined
      },
    },
  })
  const host = result.container.querySelector<HTMLElement>('[data-level-canvas]')
  if (host === null) throw new Error('no canvas host')
  host.style.width = '320px'
  host.style.height = '200px'
  return { ...result, host }
}

const drawn = async (host: HTMLElement) =>
  expect.poll(() => host.dataset['state'], { timeout: 10_000 }).toBe('drawn')

describe('LevelCanvas', () => {
  it('reads the level’s images from the workspace, then draws', async () => {
    const reads: string[] = []
    const { host } = mountCanvas(reads)
    await drawn(host)
    expect(reads).toEqual(['assets/terrain.png'])
    expect(host.querySelector('canvas')).not.toBeNull()
  })

  it('draws another level when the view moves to it, reading only what is new', async () => {
    const reads: string[] = []
    const { host, rerender } = mountCanvas(reads)
    await drawn(host)
    await rerender({ view: drawView({ level: 'cellar' }) })
    await expect.poll(() => reads).toEqual(['assets/terrain.png', 'art/cellar.png', 'assets/terrain.png'])
    await drawn(host)
  })

  it('says "Preview paused" while the context is lost, and nothing once it is back', async () => {
    const { host, queryByRole } = mountCanvas([])
    await drawn(host)
    expect(queryByRole('status')).toBeNull()
    const canvas = host.querySelector('canvas')
    const lose = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')
    if (lose === undefined || lose === null) throw new Error('Chromium has WEBGL_lose_context')
    lose.loseContext()
    await expect.poll(() => queryByRole('status')?.textContent?.trim()).toBe('Preview paused')
    expect(host.dataset['state']).toBe('paused')
    // A restore asked for while the loss event is still being delivered never arrives in Chromium; ask in a later task.
    await new Promise((resolve) => setTimeout(resolve, 0))
    lose.restoreContext()
    await expect.poll(() => queryByRole('status')).toBeNull()
    await drawn(host)
  })

  it('lets go of the renderer when it leaves the page', async () => {
    const { host, unmount } = mountCanvas([])
    await drawn(host)
    const canvas = host.querySelector('canvas')
    unmount()
    // The renderer's teardown loses its context on purpose (Pixi frees the GPU that way).
    expect(canvas?.getContext('webgl2')?.isContextLost()).toBe(true)
  })
})
