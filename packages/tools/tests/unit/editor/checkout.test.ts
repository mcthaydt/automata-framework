import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openCheckout } from '#src/features/editor/checkout.ts'
import { editorPolicy } from '#src/features/editor/editor-policy.ts'

// The checkout is where a request's path meets the disk, so these run against a real folder.
describe('the editor checkout', () => {
  let root: string
  let outside: string
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'checkout-')))
    outside = realpathSync(mkdtempSync(join(tmpdir(), 'outside-')))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })
  const checkout = () => openCheckout(root, editorPolicy(undefined))

  it('finds a path inside the checkout, even one that does not exist yet', async () => {
    expect(await checkout().locate('content/levels/a.json')).toBe(join(root, 'content/levels/a.json'))
  })

  it('refuses a path that a symlink leads out of the checkout', async () => {
    symlinkSync(outside, join(root, 'escape'))
    expect(await checkout().locate('escape/secret.txt')).toBeUndefined()
  })

  it('writes a new file and reports its modified time', async () => {
    const full = join(root, 'content/a.json')
    const outcome = await checkout().write(full, 'content/a.json', Buffer.from('{}'), 'absent')
    expect(outcome).toEqual({ mtime: expect.any(Number) })
    expect(existsSync(full)).toBe(true)
  })

  it('refuses to create a file that is there already', async () => {
    const full = join(root, 'a.json')
    writeFileSync(full, 'first')
    const outcome = await checkout().write(full, 'a.json', Buffer.from('second'), 'absent')
    expect(outcome).toEqual({ conflict: 'a.json is there already' })
  })

  it('refuses a write over a file that changed since it was read, and makes no folder for it', async () => {
    const full = join(root, 'deep/new/a.json')
    const outcome = await checkout().write(full, 'deep/new/a.json', Buffer.from('x'), '123')
    expect(outcome).toEqual({ conflict: 'deep/new/a.json changed on disk since the editor read it' })
    expect(existsSync(join(root, 'deep'))).toBe(false)
  })

  it('lists only what the policy lets the editor read, in path order, under a prefix', async () => {
    mkdirSync(join(root, 'node_modules/x'), { recursive: true })
    writeFileSync(join(root, 'node_modules/x/ignored.json'), '{}')
    mkdirSync(join(root, 'content/levels'), { recursive: true })
    writeFileSync(join(root, 'content/levels/b.json'), '{}')
    writeFileSync(join(root, 'content/levels/a.json'), '{}')
    const listed = await checkout().list('content/')
    expect(listed.map((file) => file.path)).toEqual(['content/levels/a.json', 'content/levels/b.json'])
  })
})
