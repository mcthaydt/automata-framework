import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkPlayer, checkPlayerCommand } from '#src/features/check-player/check-player-command.ts'
import { templateFiles } from '#src/shared/create-game/template-files.ts'
import { toolsVersion } from '#src/shared/create-game/tools-version.ts'

const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** A new game, as a phone makes it, written to a folder. */
function newGameOnDisk(): string {
  const root = mkdtempSync(join(tmpdir(), 'check-player-'))
  folders.push(root)
  for (const file of templateFiles({
    id: 'lantern-run',
    title: 'Lantern Run',
    frameworkVersion: toolsVersion(),
  })) {
    mkdirSync(dirname(join(root, file.path)), { recursive: true })
    writeFileSync(join(root, file.path), file.text)
  }
  return root
}

describe('automata check-player', () => {
  it('passes the 2D starter', async () => {
    expect(await checkPlayer(newGameOnDisk())).toEqual({ ok: true })
  })

  it('refuses a game that imports a package the phone app does not carry, in words', async () => {
    const root = newGameOnDisk()
    const main = join(root, 'src/main.ts')
    writeFileSync(main, `import * as THREE from 'three'\n${readFileSync(main, 'utf8')}\nvoid THREE\n`)
    const result = await checkPlayer(root)
    expect(result).toMatchObject({
      ok: false,
      message: "This game uses three, which the phone app can't run. Play it on a computer.",
    })
  })

  it('exits 0 and says the game plays, or exits 1 and says why', async () => {
    const out: string[] = []
    const err: string[] = []
    const io = { stdout: (text: string) => out.push(text), stderr: (text: string) => err.push(text) }
    expect(await checkPlayerCommand([newGameOnDisk()], io)).toBe(0)
    expect(out.join('')).toContain('plays on a phone or tablet')

    const root = newGameOnDisk()
    writeFileSync(join(root, 'src/extra.ts'), `import 'three'\n`)
    writeFileSync(
      join(root, 'src/main.ts'),
      `import './extra.ts'\n${readFileSync(join(root, 'src/main.ts'), 'utf8')}`,
    )
    expect(await checkPlayerCommand([root], io)).toBe(1)
    expect(err.join('')).toContain("can't run")
  })

  it('answers --help in plain words', async () => {
    const out: string[] = []
    expect(
      await checkPlayerCommand(['--help'], { stdout: (t) => out.push(t), stderr: () => undefined }),
    ).toBe(0)
    expect(out.join('')).toContain('Usage: automata check-player')
  })
})
