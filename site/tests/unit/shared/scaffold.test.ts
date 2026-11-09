import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Website Monorepo Workspace Integration', () => {
  it('has package.json with svelte 5 and adapter-static', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf-8'))
    expect(pkg.name).toBe('@automataframework/automata-site')
    expect(pkg.devDependencies).toHaveProperty('@sveltejs/adapter-static')
    expect(pkg.devDependencies).toHaveProperty('svelte')
  })
})
