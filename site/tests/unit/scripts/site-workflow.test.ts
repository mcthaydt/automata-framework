// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(resolve(import.meta.dirname, '../../../..', file), 'utf8')
const site = read('.github/workflows/site.yml')

describe('the site workflow', () => {
  it('deploys to Cloudflare Pages with the account token and variable, and no other host token', () => {
    expect(site).toContain('CLOUDFLARE_API_TOKEN')
    expect(site).toContain('vars.CLOUDFLARE_ACCOUNT_ID')
    expect(site).toContain('wrangler pages deploy')
    expect(site).not.toContain('SITE_DEPLOY_TOKEN')
    expect(read('.github/workflows/ci.yml')).not.toContain('SITE_DEPLOY_TOKEN')
  })

  it('checks the build before the upload and the live host after it', () => {
    const order = ['check:site', 'check:launch', 'pages deploy', 'check:deployed']
    const at = order.map((step) => site.indexOf(step))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('removes the compressed copies before the upload, which the host would publish as addresses', () => {
    expect(site.indexOf("-name '*.br'")).toBeGreaterThan(0)
    expect(site.indexOf("-name '*.br'")).toBeLessThan(site.indexOf('pages deploy'))
  })

  it('still passes with "No host configured yet." while no token is set', () => {
    expect(site).toContain('No host configured yet.')
  })
})
