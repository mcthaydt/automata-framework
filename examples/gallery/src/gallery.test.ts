import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEMOS } from './demos.ts'

const examples = fileURLToPath(new URL('../../', import.meta.url))

/** Every `examples/<package>/<demo>/` with a package.json: a demo, by the convention in examples/README.md. */
function demoFolders(): string[] {
  const found: string[] = []
  for (const group of readdirSync(examples, { withFileTypes: true })) {
    if (!group.isDirectory() || group.name === 'node_modules') continue
    for (const demo of readdirSync(join(examples, group.name), { withFileTypes: true })) {
      if (demo.isDirectory() && existsSync(join(examples, group.name, demo.name, 'package.json')))
        found.push(`${group.name}/${demo.name}`)
    }
  }
  return found.sort()
}

describe('the gallery', () => {
  it('lists every demo folder, and nothing else', () => {
    expect(DEMOS.map((demo) => demo.path).sort()).toEqual(demoFolders())
  })

  it("names each demo's own package", () => {
    for (const demo of DEMOS) {
      const pkg = JSON.parse(readFileSync(join(examples, demo.path, 'package.json'), 'utf8')) as {
        name: string
      }
      expect(pkg.name, demo.path).toBe(demo.package)
    }
  })

  it('finds the header examples/README.md asks for at the top of each main.ts', () => {
    for (const demo of DEMOS) {
      const main = join(examples, demo.path, 'main.ts')
      const header = readFileSync(main, 'utf8').split('\nimport')[0] ?? ''
      // "Shows:", or "What it shows:" as ui/primitives words it.
      for (const part of [/[Ss]hows:/, /Controls:/, /Base:/, /Packages:/])
        expect(header, `${demo.path} ${part}`).toMatch(part)
    }
  })
})
