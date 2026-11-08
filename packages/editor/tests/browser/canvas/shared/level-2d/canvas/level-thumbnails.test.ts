import { afterEach, describe, expect, it } from 'vitest'
import { createColorResolver } from '#src/shared/level-2d/canvas/colors.ts'
import { createLevelThumbnails, type LevelThumbnails } from '#src/shared/level-2d/canvas/level-thumbnails.ts'
import { richProject } from '#src/testing/level-2d/draw-fixtures.ts'
import { cellsPng } from '#src/testing/level-2d/png.ts'
import { withDefs } from '#src/testing/level-2d/project-edit.ts'

// Home's card thumbnails (ED2D.4c3b, plan decision 9) in Chromium.

const colors = createColorResolver(() => '')
let thumbnails: LevelThumbnails | undefined
afterEach(() => {
  thumbnails?.dispose()
  thumbnails = undefined
})

function setup(makeCanvas: () => HTMLCanvasElement = () => document.createElement('canvas')) {
  const reads: string[] = []
  thumbnails = createLevelThumbnails({
    read: async (path) => {
      reads.push(path)
      return undefined
    },
    colors,
    makeCanvas,
  })
  return { thumbnails, reads }
}

/** The rich fixture with a tileset image, so each render reads the workspace. */
const project = withDefs(richProject(), (defs) => ({
  ...defs,
  tilesets: defs.tilesets.map((set) => ({ ...set, image: 'assets/terrain.png' })),
}))

async function sizeOf(url: string): Promise<{ w: number; h: number }> {
  const image = new Image()
  image.src = url
  await image.decode()
  return { w: image.naturalWidth, h: image.naturalHeight }
}

describe('level thumbnails', () => {
  it('draws the level as a PNG fitted in 96 × 96 px', async () => {
    const { thumbnails } = setup()
    const url = await thumbnails.thumbnail('a', { project, level: 'start' })
    expect(url?.startsWith('data:image/png;base64,')).toBe(true)
    // The level is 64 × 48 px: scaled by 1.5 it is 96 × 72.
    expect(await sizeOf(url as string)).toEqual({ w: 96, h: 72 })
  })

  it('draws a key once, and another key again', async () => {
    const { thumbnails, reads } = setup()
    const first = await thumbnails.thumbnail('a', { project, level: 'start' })
    expect(await thumbnails.thumbnail('a', { project, level: 'start' })).toBe(first)
    expect(reads).toEqual(['assets/terrain.png'])
    await thumbnails.thumbnail('b', { project, level: 'cellar' })
    expect(reads.length).toBeGreaterThan(1)
  })

  it('answers undefined when it cannot have WebGL, or once disposed', async () => {
    const taken = () => {
      const canvas = document.createElement('canvas')
      canvas.getContext('2d')
      return canvas
    }
    const failing = setup(taken).thumbnails
    expect(await failing.thumbnail('a', { project, level: 'start' })).toBeUndefined()
    failing.dispose()
    const { thumbnails: working } = setup()
    working.dispose()
    expect(await working.thumbnail('a', { project, level: 'start' })).toBeUndefined()
  })

  it('answers undefined for a preview it cannot draw, and goes on drawing the next', async () => {
    const { thumbnails } = setup()
    expect(await thumbnails.thumbnail('gone', { project, level: 'nowhere' })).toBeUndefined()
    expect(await thumbnails.thumbnail('a', { project, level: 'start' })).toMatch(/^data:image\/png/)
  })

  it('reads its images afresh for each thumbnail: nothing is kept between cards', async () => {
    const png = await cellsPng(1, 1, 16, ['#ff0000'])
    const reads: string[] = []
    const fresh = createLevelThumbnails({
      read: async (path) => {
        reads.push(path)
        return png
      },
      colors,
      makeCanvas: () => document.createElement('canvas'),
    })
    thumbnails = fresh
    await fresh.thumbnail('a', { project, level: 'start' })
    await fresh.thumbnail('b', { project, level: 'start' })
    expect(reads).toEqual(['assets/terrain.png', 'assets/terrain.png'])
  })

  it('answers undefined for a canvas that can only give WebGL 1', async () => {
    const { thumbnails: webgl1 } = setup(() => {
      const canvas = document.createElement('canvas')
      canvas.getContext('webgl')
      return canvas
    })
    expect(await webgl1.thumbnail('a', { project, level: 'start' })).toBeUndefined()
  })
})
