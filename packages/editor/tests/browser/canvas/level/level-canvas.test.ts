import '#src/shared/kit/tokens.css'
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import LevelCanvas from '#src/features/level/LevelCanvas.svelte'
import { drawView, richProject } from '#src/testing/level-2d/draw-fixtures.ts'
import { withDefs } from '#src/testing/level-2d/project-edit.ts'

// The canvas component in Chromium: it loads the level's images from the
// workspace, draws, and says "Preview paused" while the WebGL context is lost.

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

function project() {
  // The rich fixture's tileset, now with an image that the store does not have, and a level background that it has.
  return withDefs(richProject(), (defs) => ({
    ...defs,
    tilesets: defs.tilesets.map((set) => ({ ...set, image: 'assets/terrain.png' })),
  }))
}

function mountCanvas(reads: string[], level = 'start') {
  const box = document.body.appendChild(document.createElement('div'))
  box.style.width = '320px'
  box.style.height = '200px'
  const result = render(LevelCanvas, {
    target: box,
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
    // Chromium paints a lost canvas white with a broken-image glyph; the canvas is hidden so only the notice shows.
    expect(getComputedStyle(canvas as HTMLCanvasElement).visibility).toBe('hidden')
    // A restore asked for while the loss event is still being delivered never arrives in Chromium; ask in a later task.
    await new Promise((resolve) => setTimeout(resolve, 0))
    lose.restoreContext()
    await expect.poll(() => queryByRole('status')).toBeNull()
    await drawn(host)
    expect(getComputedStyle(canvas as HTMLCanvasElement).visibility).toBe('visible')
  })

  it('publishes the camera it drew with, so a journey can tap a cell (data-camera: x,y,scale)', async () => {
    const { host, rerender } = mountCanvas([])
    await drawn(host)
    // With no camera it fits the level to its 320 x 200 box: a scale, and an offset that centres it.
    const [x, y, scale] = (host.dataset['camera'] ?? '').split(',').map(Number)
    expect(scale).toBeGreaterThan(0)
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    await rerender({ camera: { x: 4, y: 8, scale: 2 } })
    await expect.poll(() => host.dataset['camera']).toBe('4,8,2')
  })

  it('follows its box: a new size resizes the drawing buffer', async () => {
    const { host } = mountCanvas([])
    await drawn(host)
    const canvas = host.querySelector('canvas')
    const box = host.parentElement as HTMLElement
    box.style.width = '400px'
    await expect.poll(() => canvas?.width).toBe(400 * devicePixelRatio)
    expect(host.dataset['state']).toBe('drawn')
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
