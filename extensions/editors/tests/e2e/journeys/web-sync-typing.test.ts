import { expect, test } from '@playwright/test'
import { comeToFront, keptOnTwoDevices, SAVED } from '../harness/two-devices.ts'
import { openFromRail } from '../harness/web-editing.ts'

// The audit's three losses on the way to GitHub: the saved line said GitHub had a change before it did, and a pull that
// arrived while someone was typing wrote over the other device's change and ate the keys typed next.

const SHOP = 'content/lines/shop.toml'
const SENDING = /Saved on this device\. Sending to GitHub…/

test('the line does not say GitHub has the change until GitHub has it', async () => {
  const { a, github, stop } = await keptOnTwoDevices()
  try {
    await openFromRail(a, 'Writer')
    const line = a.getByRole('textbox', { name: 'What it says' }).first()
    await line.click()
    await line.press('ControlOrMeta+A')
    await line.pressSequentially('Alice wrote this.')
    // Written here, not sent: the line says so for as long as that is true.
    await expect(a.getByRole('status').filter({ hasText: SENDING })).toBeVisible()
    expect(github.rest.file(SHOP)).not.toContain('Alice wrote this.')
    await expect(a.getByRole('status').filter({ hasText: SAVED })).toBeVisible({ timeout: 40_000 })
    // The moment it says GitHub has it, GitHub has it.
    expect(github.rest.file(SHOP)).toContain('Alice wrote this.')
  } finally {
    await stop()
  }
})

test('a pull that arrives mid-sentence does not eat the keys or write over the other device, and asks instead', async () => {
  const { a, b, github, stop } = await keptOnTwoDevices()
  try {
    // Device A changes the first line and it reaches GitHub; device B has not heard.
    await openFromRail(a, 'Writer')
    const lineA = a.getByRole('textbox', { name: 'What it says' }).first()
    await lineA.click()
    await lineA.press('ControlOrMeta+A')
    await lineA.pressSequentially('Offline words.')
    await expect.poll(() => github.rest.file(SHOP), { timeout: 40_000 }).toContain('Offline words.')

    // Device B is typing in the same line when its tab is brought to the front, and goes on typing.
    await openFromRail(b, 'Writer')
    const lineB = b.getByRole('textbox', { name: 'What it says' }).first()
    await lineB.click()
    await lineB.press('ControlOrMeta+A')
    await lineB.pressSequentially('Bob is typing here')
    await comeToFront(b)
    await lineB.pressSequentially(' and more')
    // Not one key went missing, the field kept the cursor, and the screen shows B's own words.
    await expect(lineB).toBeFocused()
    await expect(lineB).toHaveValue('Bob is typing here and more')

    // Once B stops, the two changes to one line are asked about, not decided: nothing was sent over A's words.
    const asked = b.getByRole('dialog', { name: /changed here and on GitHub/ })
    await expect(asked).toBeVisible({ timeout: 30_000 })
    await expect(asked).toContainText('Nothing has been lost.')
    expect(github.rest.file(SHOP)).toContain('Offline words.')
    expect(github.rest.file(SHOP)).not.toContain('Bob is typing')

    await asked.getByRole('button', { name: 'Keep mine' }).click()
    await expect(asked).toBeHidden({ timeout: 20_000 })
    await expect
      .poll(() => github.rest.file(SHOP), { timeout: 40_000 })
      .toContain('Bob is typing here and more')
    await expect(b.getByRole('status').filter({ hasText: SAVED })).toBeVisible({ timeout: 20_000 })
  } finally {
    await stop()
  }
})
