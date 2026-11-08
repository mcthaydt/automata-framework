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
  const checkout = () => openCheckout(root, async () => editorPolicy(undefined))

  it('finds a path inside the checkout, even one that does not exist yet', async () => {
    expect(await checkout().locate('content/levels/a.af2d.json')).toBe(
      join(root, 'content/levels/a.af2d.json'),
    )
  })

  it('refuses a path that a symlink leads out of the checkout', async () => {
    symlinkSync(outside, join(root, 'escape'))
    expect(await checkout().locate('escape/secret.txt')).toBeUndefined()
  })

  it('writes a new file and reports its modified time', async () => {
    const full = join(root, 'content/a.af2d.json')
    const outcome = await checkout().write(full, 'content/a.af2d.json', Buffer.from('{}'), 'absent')
    expect(outcome).toEqual({ mtime: expect.any(Number) })
    expect(existsSync(full)).toBe(true)
  })

  it('refuses to create a file that is there already', async () => {
    const full = join(root, 'a.af2d.json')
    writeFileSync(full, 'first')
    const outcome = await checkout().write(full, 'a.af2d.json', Buffer.from('second'), 'absent')
    expect(outcome).toEqual({ conflict: 'a.af2d.json is there already' })
  })

  it('refuses a write over a file that changed since it was read, and makes no folder for it', async () => {
    const full = join(root, 'deep/new/a.af2d.json')
    const outcome = await checkout().write(full, 'deep/new/a.af2d.json', Buffer.from('x'), '123')
    expect(outcome).toEqual({ conflict: 'deep/new/a.af2d.json changed on disk since the editor read it' })
    expect(existsSync(join(root, 'deep'))).toBe(false)
  })

  it('lists only what the policy lets the editor read, in path order, under a prefix', async () => {
    mkdirSync(join(root, 'node_modules/x'), { recursive: true })
    writeFileSync(join(root, 'node_modules/x/ignored.json'), '{}')
    mkdirSync(join(root, 'content/levels'), { recursive: true })
    writeFileSync(join(root, 'content/levels/b.af2d.json'), '{}')
    writeFileSync(join(root, 'content/levels/a.af2d.json'), '{}')
    const listed = await checkout().list('content/')
    expect(listed.map((file) => file.path)).toEqual([
      'content/levels/a.af2d.json',
      'content/levels/b.af2d.json',
    ])
  })

  it('lists the rest when a file is gone between being named and being read, as a build’s temp file is', async () => {
    // The content compiler writes a file, then renames it, while the editor lists the folder.
    mkdirSync(join(root, 'content'), { recursive: true })
    writeFileSync(join(root, 'content/a.af2d.json'), '{}')
    writeFileSync(join(root, 'content/b.af2d.json'), '{}')
    const policy = editorPolicy(undefined)
    const vanishing = openCheckout(root, async () => ({
      ...policy,
      canRead(path) {
        if (path === 'content/a.af2d.json') rmSync(join(root, path))
        return policy.canRead(path)
      },
    }))
    expect((await vanishing.list('content/')).map((file) => file.path)).toEqual(['content/b.af2d.json'])
  })
})
