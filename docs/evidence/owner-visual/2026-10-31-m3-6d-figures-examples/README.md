# M3.6d part 2: the figures examples (poses, clips, aim), 2026-10-31

Canvas captures of the three new one-file figure examples for visual review, taken in headless Chromium (Playwright 1.63.0) under the fake host and Ruken's CSP, in this container (software WebGL), at 844×390 and 780×270 (CSS pixels; the files are device pixels). They are evidence, not goldens. The times are from the Play click; under software WebGL the sim runs a little behind the wall clock, so they do not line up exactly with the sim's steps.

| Image | What it shows | Check |
|---|---|---|
| `figures-poses-*-1500ms`, `-3500ms`, `-5500ms`, `-7500ms`, `-9500ms` | Wick, facing the fixed camera 2 m away, in each pose of the library in turn: `stand`, `kneel`, `guard-high`, `point`, `reach-out` (one every 2 s) | Kneeling drops him onto the right knee with the left foot forward; the guard brings both hands before the face; pointing raises the right arm forward at shoulder height with the head turned; the reach puts the right hand before the chest. Each clip blends from the pose before it (no dip back to idle between poses) |
| `figures-clips-*-800ms`, `-2300ms`, `-3200ms` | Wick walking back and forth under the default follow view (24 mm, 25° down, 5 m back) with `reach`, `look` and `flinch` played over the walk (one every 1.5 s) | The legs keep walking under each clip (the masks leave them to the gait): the right arm reaches forward, then the head and chest turn, then the forearms come up before the face |
| `figures-aim-*-before`, `-left`, `-behind`, `-right` | Wick standing at yaw 0, facing the fixed camera (at shoulder height, 3.4 m in front), the red orb circling him at head height around a 2 m square. Each image is taken when the orb is at the middle of a side, read from the sim's aim point (below): `before` (0, 1), between Wick and the camera; `left` (1, 0), his left, screen right; `behind` (0, −1); `right` (−1, 0), his right, screen left | `before`: his face to the camera, the orb before his eyes. `left`: head turned to his left, the right hand reaching across his chest to the orb. `behind`: the head and chest held at the rig's limits (the head does not turn round), the orb showing over his head. `right`: head turned to his right (an eye shows), the right arm out to the orb |

### Review note: the first figures-aim captures (replaced)

The first captures (`figures-aim-*-700ms` and so on) looked as if Wick had his back to the camera with the orb behind him. Checked with a temporary attribute logging the aim point the view received at each capture, in the same frame as the canvas read: the orb is drawn where the aim point is, Wick faces the camera at yaw 0, and the captures ran about 0.8 s of sim time behind their labels (the "700 ms" image is the orb at (0.84, 1), before him and to his left, not at (0, 1)). The back view was the camera: from 1.9 m, looking down, his one-pixel eyes hide under his brow and his black face reads as the back of his head (lowered to 1.1 m with aim off, the eye shows). The example's camera is now at 1.4 m looking at 0.9 m, and the images are taken by sim state, not wall time.
## Capture script

figures-poses and figures-clips were captured by wall time with the script below. figures-aim was recaptured by sim state: for the run only, `watching` set `document.body`'s `data-diag` attribute to the aim point (`x,z`), and the capture waited in frame callbacks until the point was within 0.06 m of each side's middle before reading the canvas in that same callback; the attribute was then removed.

Run from the repo root as `examples/e2e/capture-m3-6d.e2e.ts` with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local pnpm exec playwright test examples/e2e/capture-m3-6d.e2e.ts --project=examples-compact --workers=1`, then deleted. The canvas is read back in the page inside a frame callback: a locator screenshot took seconds here, which skewed the times.

```ts
// Review captures for M3.6d part 2 (not a test; deleted after use, kept in the evidence README).
import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { openHosted } from '@mcthaydt/examples-runner/host/testing'
import { writeFileSync } from 'node:fs'
import { test } from '@playwright/test'

const out = process.env.OUT ?? 'docs/evidence/owner-visual/2026-10-31-m3-6d-figures-examples'
const shots: Record<string, number[]> = {
  poses: [1500, 3500, 5500, 7500, 9500],
  clips: [800, 2300, 3200],
  aim: [700, 2200, 3700, 5200],
}
for (const [width, height] of [
  [844, 390],
  [780, 270],
] as const) {
  for (const [name, times] of Object.entries(shots)) {
    test(`figures-${name} at ${width}x${height}`, async ({ page }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width, height })
      const frame = await openHosted(
        page,
        `http://localhost:${examplesPort}/figures/${name}/`,
        `figures-${name}`,
      )
      await frame.getByTestId('play').click()
      const start = Date.now()
      for (const at of times) {
        await page.waitForTimeout(Math.max(0, at - (Date.now() - start)))
        // The canvas read back in the page (a locator screenshot takes seconds here, which would skew the times).
        const png = await frame.evaluate(
          () =>
            new Promise<string>((resolve) => {
              requestAnimationFrame(() => {
                const canvas = document.querySelector<HTMLCanvasElement>('canvas.af-stage')
                const copy = document.createElement('canvas')
                copy.width = canvas?.width ?? 0
                copy.height = canvas?.height ?? 0
                if (canvas !== null) copy.getContext('2d')?.drawImage(canvas, 0, 0)
                resolve(copy.toDataURL('image/png'))
              })
            }),
        )
        writeFileSync(
          `${out}/figures-${name}-${width}x${height}-${at}ms.png`,
          Buffer.from(png.split(',')[1] ?? '', 'base64'),
        )
      }
    })
  }
}
```
