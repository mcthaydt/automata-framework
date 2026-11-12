import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openEditor, openPanel, pressGame } from '../harness/complete-game.ts'
import { expect, openRoom, test } from '../harness/fixtures.ts'
import { boxOf, readPng } from '../harness/read-png.ts'
import { runEditor } from '../harness/run-editor.ts'
import { copyInstalledGame } from '../harness/temp-game.ts'

// A story made in the editors is the story the game plays. The 2D story (a Hall and a Yard with a wall and a gap between
// them, a keeper, a guard) is copied, its keeper is given a new colour in Characters, and the game's Play button opens it.
// The keeper is the new colour on the canvas; walking up to him opens the dialogue box with his words; the second answer
// starts the cutscene, whose caption shows; and the guard, who sees the player through the gap, comes through it.
// (That he loses a player behind the wall is the sim's, proved in the example's unit tests.)
//
// NOT YET RUN HERE: changing the keeper's words in Writer, the caption in Sequence and the guard's chase speed in
// Schematic. Those editors (PR #478) are not on this branch, so those steps are left unchecked in the plan's log; this
// journey never writes the TOML behind an editor's back and counts it as edited.

const STORY: string = fileURLToPath(new URL('../../../../../examples/2d-story', import.meta.url))
/** The level's background, which the canvas shows around everything else. */
const BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]
/** The guard's colour in Characters, and the colour the keeper is given. */
const GUARD: readonly [number, number, number] = [0xef, 0x44, 0x44]
const NEW_KEEPER = '#ff00ff'
const NEW_KEEPER_RGB: readonly [number, number, number] = [0xff, 0x00, 0xff]

// A step that cannot be done fails in seconds, not at the end of the test's own timeout.
test.use({ actionTimeout: 10_000 })

test('the keeper’s colour, his words, the cutscene and the guard are what the played story shows', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000)
  const game = copyInstalledGame(STORY)
  const editor = await runEditor(game.dir)
  try {
    await openRoom(page, editor, 'Start')

    // Give the keeper a new colour in Characters; the editor saves it into the game's project file.
    await openEditor(page, editor, 'Characters')
    // Below the wide layout the characters sit in a sheet behind the top bar's Panel button, their settings behind Details.
    const keeper = page.getByRole('radio', { name: /Keeper/ })
    await openPanel(page)
    await keeper.click()
    const details = page.getByRole('button', { name: 'Details' })
    if ((await details.getAttribute('aria-expanded')) === 'false') await details.click()
    await page.screenshot({ path: test.info().outputPath('characters.png') })
    await page.getByRole('button', { name: /^Colour/ }).click()
    await page.getByRole('button', { name: 'Custom' }).click()
    const hex = page.getByRole('textbox', { name: 'Colour custom hex' })
    await hex.fill(NEW_KEEPER)
    await hex.press('Enter')
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/project.toml'), 'utf8'), { timeout: 30_000 })
      .toContain(`color = "${NEW_KEEPER}"`)

    const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
    const canvas = play.locator('#game canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    await play.getByRole('button', { name: /play/i }).first().click()
    await play.waitForTimeout(1500)

    // The keeper, standing where the editor placed him (x 200, feet at y 256), is the new colour.
    const picture = readPng(await canvas.screenshot())
    const field = boxOf(picture, BACKGROUND)
    expect(field, 'the level is on the canvas').toBeDefined()
    if (field === undefined) return
    const scale = field.w / 512
    expect(picture.at(Math.round(field.x + 200 * scale), Math.round(field.y + 244 * scale))).toEqual(
      NEW_KEEPER_RGB,
    )

    // The guard is watched from here on: where the canvas shows him, in level pixels, at every look.
    let watching = true
    let nearest = Number.POSITIVE_INFINITY
    const guardLook = (async () => {
      while (watching) {
        const box = boxOf(readPng(await canvas.screenshot()), GUARD)
        if (box !== undefined) nearest = Math.min(nearest, (box.x - field.x) / scale)
        await play.waitForTimeout(150)
      }
    })()

    // Walk up to the keeper: his box opens with his words.
    await play.keyboard.down('ArrowRight')
    await expect(play.getByTestId('dialogue-box')).toBeVisible({ timeout: 15_000 })
    await play.keyboard.up('ArrowRight')
    await expect(play.getByTestId('dialogue-speaker')).toHaveText('Keeper')
    await expect(play.getByTestId('dialogue-line')).toHaveText('Hello there. Mind the gate on your way out.')
    await expect(play.getByTestId('dialogue-choice-2')).toHaveText(/Show me the gate\./)
    await play.screenshot({ path: test.info().outputPath('dialogue.png') })

    // The second answer: he answers, then the cutscene starts with its caption above the box's place.
    await play.getByTestId('dialogue-choice-2').click()
    await expect(play.getByTestId('dialogue-line')).toHaveText('Right this way.')
    await play.getByTestId('dialogue-next').click()
    await expect(play.getByTestId('dialogue-box')).toBeHidden()
    await expect(play.getByTestId('cutscene-caption')).toHaveText('A moment later, at the gate.')
    await play.screenshot({ path: test.info().outputPath('cutscene.png') })
    await expect(play.getByTestId('cutscene-caption')).toBeHidden({ timeout: 15_000 })

    // The guard, in the Yard, saw the player through the gap while they talked, and came through it: at some look he
    // stood left of the wall (the wall is the column at x 256 to 272).
    await expect
      .poll(() => nearest, { message: 'the guard came through the gap towards the player', timeout: 20_000 })
      .toBeLessThan(240)
    await play.screenshot({ path: test.info().outputPath('guard.png') })
    watching = false
    await guardLook
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
})
