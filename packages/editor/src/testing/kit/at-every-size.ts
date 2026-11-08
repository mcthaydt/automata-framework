// The seven window sizes every v2 screen is measured at, in both looks: two desktop windows, an iPad held either way and
// three phone sizes (the last is a small, short phone). A layout test hands in how to size the window (`page.viewport` in
// Vitest browser mode) so this file imports no test runner.

export interface WindowSize {
  readonly name: string
  readonly width: number
  readonly height: number
  /** Whether the person touches (44 px targets) rather than points (32 px). */
  readonly touch: boolean
}

export const WINDOW_SIZES: readonly WindowSize[] = [
  { name: 'desktop-1440x900', width: 1440, height: 900, touch: false },
  { name: 'desktop-1024x768', width: 1024, height: 768, touch: false },
  { name: 'ipad-landscape-1194x834', width: 1194, height: 834, touch: true },
  { name: 'ipad-portrait-820x1180', width: 820, height: 1180, touch: true },
  { name: 'phone-portrait-390x844', width: 390, height: 844, touch: true },
  { name: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { name: 'phone-small-360x640', width: 360, height: 640, touch: true },
]

/** Runs `run` once at each size, in order, after `resize` has set the window to it. */
export async function atEverySize(
  resize: (width: number, height: number) => Promise<void>,
  run: (size: WindowSize) => Promise<void>,
  sizes: readonly WindowSize[] = WINDOW_SIZES,
): Promise<void> {
  for (const size of sizes) {
    await resize(size.width, size.height)
    await run(size)
  }
}
