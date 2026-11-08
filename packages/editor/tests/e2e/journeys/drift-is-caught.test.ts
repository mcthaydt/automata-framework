import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLevels, expect, test } from '../harness/fixtures.ts'

// Spec section 9, "Drift is caught": a level file changed by hand no longer matches the project the editor saved it
// from, and `automata check --only levels` says which file and which project (section 6.3's message).

test('a level file edited by hand fails the check, naming the file and its project', async ({ game }) => {
  expect((await checkLevels(game.dir)).code).toBe(0)

  const levelFile = join(game.dir, 'content/levels/room-1.toml')
  // Someone opens the level file and adds a wall in row 2 themselves, outside the editor.
  const text = readFileSync(levelFile, 'utf8')
  writeFileSync(levelFile, text.replace('"1 .*38 1", "1 .*38 1"', '"1 .*38 1", "1 1 .*37 1"'))

  const check = await checkLevels(game.dir)
  expect(check.code).not.toBe(0)
  expect(check.output).toContain('content/levels/room-1.toml does not match content/rooms/room-1.af2d.json.')
})
