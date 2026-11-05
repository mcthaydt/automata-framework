import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { tauriIconPng } from '#src/shared/ship/targets/tauri/tauri-icon.ts'

// The icon ship draws when a game names none (DIST spec §6.2): a valid RGBA PNG, the same bytes every time.
describe('tauriIconPng', () => {
  const png = tauriIconPng(512)

  it('is a PNG of the asked size, 8-bit RGBA, whose image data inflates to every row', () => {
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.toString('latin1', 12, 16)).toBe('IHDR')
    expect(png.readUInt32BE(16)).toBe(512)
    expect(png.readUInt32BE(20)).toBe(512)
    expect([png[24], png[25]]).toEqual([8, 6])
    const idat = png.indexOf('IDAT', 0, 'latin1')
    const length = png.readUInt32BE(idat - 4)
    expect(inflateSync(png.subarray(idat + 4, idat + 4 + length)).length).toBe(512 * (1 + 512 * 4))
    expect(png.toString('latin1', png.length - 8, png.length - 4)).toBe('IEND')
  })

  it('gives the same bytes every time', () => {
    expect(tauriIconPng(512).equals(png)).toBe(true)
  })
})
