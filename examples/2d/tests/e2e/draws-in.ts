import { expect, type Locator } from '@playwright/test'

/**
 * "No device fallback": the page draws in the pixel face the example ships for a language, and the face has loaded.
 * `--af-font` is what the framework's theme draws in, so it names the face, and the face's own state says its file
 * arrived; a menu in a device's font would leave both unmet. `html` is the page's root element (or its frame's).
 */
export async function drawsIn(html: Locator, face: string): Promise<void> {
  const unquoted = (text: string): string => text.replaceAll('"', '')
  await expect
    .poll(async () =>
      unquoted(await html.evaluate((el) => getComputedStyle(el).getPropertyValue('--af-font'))),
    )
    .toContain(face)
  await expect
    .poll(async () =>
      (
        await html.evaluate((el) =>
          [...el.ownerDocument.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
        )
      ).map(unquoted),
    )
    .toContain(face)
}
