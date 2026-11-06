import { describe, expect, it } from 'vitest'
import { IPAD_PROFILES, turned } from './ipad-profiles'
import { journeyProject } from './journey-project'

describe('the iPad journey profiles (plan EDK.6b decision 3)', () => {
  it('are the four iPads of the kit spec §7, by name and size', () => {
    expect(IPAD_PROFILES.map(({ name, width, height }) => `${name} ${width}×${height}`)).toEqual([
      'ipad-pro-11-landscape 1194×834',
      'ipad-pro-11-portrait 834×1194',
      'ipad-mini-landscape 1133×744',
      'ipad-pro-13-landscape 1366×1024',
    ])
  })

  it('turn a profile a quarter round, as EK-c turns the iPad', () => {
    expect(turned({ name: 'ipad-pro-11-landscape', width: 1194, height: 834 })).toEqual({
      name: 'ipad-pro-11-landscape turned',
      width: 834,
      height: 1194,
    })
  })

  it('give each package one journeys project: WebKit with an iPad context, over its *.journey.test.ts files', () => {
    const project = journeyProject((options) => ({ provider: 'playwright', ...options }))
    expect(project.test.name).toBe('journeys')
    expect(project.test.include).toEqual(['src/**/*.journey.test.ts'])
    expect(project.test.browser.instances).toEqual([{ browser: 'webkit' }])
    expect(project.test.browser.provider).toMatchObject({
      provider: 'playwright',
      contextOptions: { hasTouch: true, deviceScaleFactor: 2 },
    })
    expect(project.contextOptions.userAgent).toContain('iPad')
  })
})
