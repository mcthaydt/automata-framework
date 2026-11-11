// Shared by the character kit's journeys: a count of the colours the game canvas shows, read in the page.
import type { Frame } from '@playwright/test'

/** How many distinct colours the game canvas shows in its left, middle and right third (counted in the page, right after the game drew it). */
export const coloursPerThird = (frame: Frame): Promise<[number, number, number]> =>
  frame.evaluate(
    () =>
      new Promise<[number, number, number]>((resolve) => {
        requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
          const copy = document.createElement('canvas')
          const context = copy.getContext('2d')
          if (canvas === null || context === null) return resolve([0, 0, 0])
          copy.width = canvas.width
          copy.height = canvas.height
          context.drawImage(canvas, 0, 0)
          const data = context.getImageData(0, 0, copy.width, copy.height).data
          const thirds = [new Set<number>(), new Set<number>(), new Set<number>()]
          for (let i = 0; i < data.length; i += 4) {
            const third = Math.min(2, Math.floor((((i / 4) % copy.width) / copy.width) * 3))
            thirds[third]?.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0))
          }
          resolve([thirds[0]?.size ?? 0, thirds[1]?.size ?? 0, thirds[2]?.size ?? 0])
        })
      }),
  )
