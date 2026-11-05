/**
 * Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so
 * ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they
 * cause have run. A semantic wait, not a sleep.
 */
export async function settleLayout(): Promise<void> {
  await document.fonts.ready
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}
