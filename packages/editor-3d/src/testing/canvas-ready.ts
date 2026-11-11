import { expect } from 'vitest'

/**
 * Waits until the element with `data-testid` has `attribute` set to `value`: a WebGL canvas reaching `drawing`, or
 * the Studio's stage reaching `ready`. When it never does, the error names what the canvas was left saying, since
 * the cause decides the fix: `starting` is a slow runner, `unavailable` is a runner without WebGL.
 */
export async function untilAttribute(
  testId: string,
  attribute: string,
  value: string,
  options: { readonly timeout?: number } = {},
): Promise<void> {
  const find = (): Element | null => document.querySelector(`[data-testid="${testId}"]`)
  try {
    await expect.poll(() => find()?.getAttribute(attribute) === value, options).toBe(true)
  } catch (cause) {
    const element = find()
    const said = element?.getAttribute(attribute) ?? null
    const state =
      element === null
        ? 'it is not on the page'
        : `its ${attribute} is "${said ?? 'missing'}"${said === 'unavailable' ? ' (no WebGL on this runner, not a slow one)' : ''}`
    throw new Error(`${testId} never got ${attribute} "${value}": ${state}`, { cause })
  }
}
