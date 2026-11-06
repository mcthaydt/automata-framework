import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import LevelCanvas from '#src/features/level/LevelCanvas.svelte'
import { createColorResolver } from '#src/shared/level-2d/canvas/colors.ts'
import type { DrawView } from '#src/shared/level-2d/canvas/draw/draw-list-types.ts'
import { PLACEHOLDER_COLORS } from '#src/shared/level-2d/canvas/draw/tile-draw.ts'
import { createLevelThumbnails } from '#src/shared/level-2d/canvas/level-thumbnails.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { drawView } from '#src/testing/level-2d/draw-fixtures.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { cellsPng } from '#src/testing/level-2d/png.ts'
import { withDefs } from '#src/testing/level-2d/project-edit.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'
import { createTestClock } from '#src/testing/level-2d/test-clock.ts'

// Images of the canvas for review. Run
// with `ED2D_VISUALS=1 pnpm test:canvas level-visuals` to write them to `docs/evidence/owner-visual/2026-10-30-ed2d-4c3b/`.
// No test compares against them: they are pictures for a person, not goldens.

declare module 'vitest' {
  interface ProvidedContext {
    writeVisuals: boolean
  }
}

/** From this file's folder to the evidence folder (screenshot paths are relative to the test file). */
const OUT = '../../../../docs/evidence/owner-visual/2026-10-30-ed2d-4c3b'
/** The Level view's canvas on an iPad 11" in landscape. */
const CANVAS = { w: 554, h: 602 }

let handle: EditorHandle | undefined
afterEach(async () => {
  cleanup()
  await handle?.dispose()
  handle = undefined
  document.body.replaceChildren()
})

/** `project` with every tileset given `image`, as an import of real art would. */
const withImage = (project: Project, image: string): Project =>
  withDefs(project, (defs) => ({ ...defs, tilesets: defs.tilesets.map((set) => ({ ...set, image })) }))

async function shoot(name: string, project: Project, view: DrawView, files: Record<string, Uint8Array> = {}) {
  await page.viewport(CANVAS.w, CANVAS.h)
  // The box is sized before the canvas mounts, as the Level view's region is.
  const box = document.body.appendChild(document.createElement('div'))
  box.style.width = `${CANVAS.w}px`
  box.style.height = `${CANVAS.h}px`
  const { container } = render(LevelCanvas, {
    target: box,
    props: { project, view, read: async (path: string) => files[path] },
  })
  const host = container.querySelector<HTMLElement>('[data-level-canvas]')
  if (host === null) throw new Error('no canvas host')
  await expect.poll(() => host.dataset['state'], { timeout: 10_000 }).toBe('drawn')
  await page.screenshot({ element: host, path: `${OUT}/${name}.png` })
  return host
}

describe.runIf(inject('writeVisuals'))('canvas images for review', () => {
  it('Mossgate (platformer sample): placeholders, the collision grid and a 2 × 2 brush footprint', async () => {
    const project = mossgate()
    const level = project.levels[0]?.id ?? ''
    await shoot(
      'level-mossgate-placeholders',
      project,
      drawView({ level, layer: 'collision', brushSize: 2, hover: { x: 6, y: 10 } }),
    )
  })

  it('Hollowmere (top-down sample): placeholders, an entity selected', async () => {
    const project = hollowmere()
    const level = project.levels[0]
    const entities = level?.layers.find((layer) => layer.kind === 'entities')
    const selected = entities?.kind === 'entities' ? entities.items.slice(0, 1).map((item) => item.id) : []
    await shoot(
      'level-hollowmere-placeholders',
      project,
      drawView({ level: level?.id ?? '', layer: 'entities', tool: 'select', selected }),
    )
  })

  it('Mossgate with a tileset image in the workspace: tiles are frames of the image', async () => {
    const project = withImage(mossgate(), 'assets/terrain.png')
    const set = project.defs.tilesets[0]
    if (set === undefined) throw new Error('Mossgate has a tileset')
    const columns = set.imageSize.w / set.tile.w
    const rows = set.imageSize.h / set.tile.h
    // Each cell a lighter or darker version of its placeholder colour, so a frame is told from a placeholder at a glance.
    const colors = Array.from({ length: columns * rows }, (_, index) => {
      const base = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length] ?? '#808080'
      return index % 2 === 0 ? base.replace(/^#8/, '#c') : base.replace(/^#5/, '#3')
    })
    const png = await cellsPng(columns, rows, set.tile.w, colors)
    await shoot(
      'level-mossgate-image-tiles',
      project,
      drawView({ level: project.levels[0]?.id ?? '', layer: 'decor' }),
      { 'assets/terrain.png': png },
    )
  })

  it('Mossgate with its tileset image missing: numbered placeholders, nothing broken', async () => {
    const project = withImage(mossgate(), 'assets/gone.png')
    await shoot(
      'level-mossgate-image-missing',
      project,
      drawView({ level: project.levels[0]?.id ?? '', layer: 'decor' }),
    )
  })

  it('the context lost: "Preview paused" over the canvas', async () => {
    const project = mossgate()
    const host = await shoot('level-before-pause', project, drawView({ level: project.levels[0]?.id ?? '' }))
    const lose = host.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')
    lose?.loseContext()
    await expect.poll(() => host.dataset['state']).toBe('paused')
    await page.screenshot({ element: host, path: `${OUT}/level-paused.png` })
  })

  it('Home with level thumbnails on the cards (iPad 11" landscape)', async () => {
    await page.viewport(1194, 834)
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    await workspace.store.write('mossgate.af2d.json', printProject(mossgate()))
    clock.advance(60_000)
    await workspace.store.write('hollowmere.af2d.json', printProject(hollowmere()))
    const target = document.body.appendChild(document.createElement('div'))
    handle = await startEditor(target, {
      window,
      document,
      workspace,
      clock: {
        now: () => clock.now(),
        setTimer: (ms, run) => window.setTimeout(run, ms),
        clearTimer: (timer) => window.clearTimeout(timer as number),
      },
      fillRandom: (bytes) => {
        crypto.getRandomValues(bytes)
      },
      thumbnails: (opened) =>
        createLevelThumbnails({
          read: (path) => opened.store.read(path),
          colors: createColorResolver((name) =>
            getComputedStyle(document.documentElement).getPropertyValue(name),
          ),
          makeCanvas: () => document.createElement('canvas'),
        }),
    })
    await expect
      .poll(() => document.querySelectorAll('[role="option"] img').length, { timeout: 10_000 })
      .toBe(2)
    await Promise.all([...document.querySelectorAll('img')].map((image) => image.decode()))
    await page.screenshot({ path: `${OUT}/home-thumbnails-1194x834.png` })
  })
})
