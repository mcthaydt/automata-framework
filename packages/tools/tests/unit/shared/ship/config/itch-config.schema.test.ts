import { describe, expect, it } from 'vitest'
import { itchConfigSchema } from '#src/shared/ship/config/itch-config.schema.ts'

describe('itchConfigSchema', () => {
  it('reads a lower-case user/game project and defaults the channel to html5', () => {
    expect(itchConfigSchema.parse({ project: 'mcthaydt/emberwick' })).toEqual({
      project: 'mcthaydt/emberwick',
      channel: 'html5',
      downloads: { linux: 'linux', mac: 'mac', windows: 'windows' },
    })
    expect(itchConfigSchema.parse({ project: 'mcthaydt/emberwick', channel: 'html5-beta' }).channel).toBe(
      'html5-beta',
    )
  })

  it('refuses a project that is not lower-case user/game, naming the field', () => {
    for (const project of ['McThaydt/Emberwick', 'emberwick', 'a/b/c', 'user/', '/game']) {
      const result = itchConfigSchema.safeParse({ project })
      expect(result.success, project).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['project'])
    }
  })

  it('refuses an empty or upper-case channel', () => {
    expect(itchConfigSchema.safeParse({ project: 'a/b', channel: '' }).success).toBe(false)
    expect(itchConfigSchema.safeParse({ project: 'a/b', channel: 'HTML5' }).success).toBe(false)
  })

  // DIST spec §6.4: the desktop bundles go to itch.io as Downloadable files, one butler channel per OS.
  it('gives each desktop OS a channel, linux, mac and windows unless the config renames one', () => {
    expect(itchConfigSchema.parse({ project: 'me/cinder' }).downloads).toEqual({
      linux: 'linux',
      mac: 'mac',
      windows: 'windows',
    })
    expect(
      itchConfigSchema.parse({ project: 'me/cinder', downloads: { mac: 'osx-universal' } }).downloads,
    ).toEqual({
      linux: 'linux',
      mac: 'osx-universal',
      windows: 'windows',
    })
    expect(itchConfigSchema.safeParse({ project: 'me/cinder', downloads: { mac: 'Mac OS' } }).success).toBe(
      false,
    )
  })
})
