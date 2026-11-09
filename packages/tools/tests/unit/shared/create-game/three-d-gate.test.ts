import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { THREE_D_NOT_PUBLIC, threeDAvailable } from '#src/shared/create-game/three-d-gate.ts'

// The 3D template needs @automata/3d, which is private until Pixi 3D is public. It is offered where that package is
// found (inside this repository's workspace) and where AF_BETA_3D=1 says the author has it.

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

/** A folder tree `depth` levels down, with `packages/3d/package.json` named `name` at its root when given. */
function tree(name: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), 'af-gate-'))
  made.push(root)
  if (name !== undefined) {
    mkdirSync(join(root, 'packages/3d'), { recursive: true })
    writeFileSync(join(root, 'packages/3d/package.json'), JSON.stringify({ name }))
  }
  mkdirSync(join(root, 'packages/tools/src/shared/create-game'), { recursive: true })
  return join(root, 'packages/tools/src/shared/create-game')
}

describe('the 3D template gate', () => {
  it('says what to do instead, in plain words', () => {
    expect(THREE_D_NOT_PUBLIC).toBe(
      '3D games need a package that is not public yet. For now, make a 2D game: leave out --template.',
    )
  })

  it('is open inside the repository, where packages/3d sits beside the tools', () => {
    expect(threeDAvailable({}, tree('@automata/3d'))).toBe(true)
  })

  it('is shut where no 3D package is found, and for a package of another name', () => {
    expect(threeDAvailable({}, tree(undefined))).toBe(false)
    expect(threeDAvailable({}, tree('@someone/3d'))).toBe(false)
  })

  it('is open with AF_BETA_3D=1 wherever the tools run, and only for exactly 1', () => {
    expect(threeDAvailable({ AF_BETA_3D: '1' }, tree(undefined))).toBe(true)
    expect(threeDAvailable({ AF_BETA_3D: '0' }, tree(undefined))).toBe(false)
    expect(threeDAvailable({ AF_BETA_3D: 'true' }, tree(undefined))).toBe(false)
  })
})
