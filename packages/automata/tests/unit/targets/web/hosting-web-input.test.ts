import { describe, expect, it } from 'vitest'
import { createWebHosting } from '#src/features/targets/web/hosting-web.ts'
import type { HostingOptions } from '#src/shared/host/hosting.ts'
import { fakeWebPage } from '#src/testing/host/page/fake-web-page.ts'

const OPTIONS: HostingOptions = { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause' }
const delivered = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** The input modes a game sees while `events` reach the page one at a time. */
async function modesAfter(
  events: readonly (readonly [string, Record<string, unknown>?])[],
): Promise<string[]> {
  const fake = fakeWebPage()
  const hosting = createWebHosting(OPTIONS, fake.page, 'web')
  const modes: string[] = []
  hosting.input.subscribe((value) => modes.push(value.mode))
  for (const [type, detail] of events) {
    fake.dispatch(type, detail)
    await delivered()
  }
  hosting.dispose()
  return modes
}

describe('the web adapter: a Pencil on an iPad (G12)', () => {
  it('shows the touch controls for a pen, and the mouse ones for a mouse', async () => {
    expect(await modesAfter([['pointerdown', { pointerType: 'pen' }]])).toEqual(['keyboard-mouse', 'touch'])
    expect(await modesAfter([['pointerdown', { pointerType: 'mouse' }]])).toEqual(['keyboard-mouse'])
  })

  it("changes once, to touch, when iPadOS sends a pen's pointerdown and then its touchstart", async () => {
    expect(
      await modesAfter([
        ['pointerdown', { pointerType: 'pen' }],
        ['touchstart'],
        ['pointerdown', { pointerType: 'pen' }],
      ]),
    ).toEqual(['keyboard-mouse', 'touch'])
  })
})
