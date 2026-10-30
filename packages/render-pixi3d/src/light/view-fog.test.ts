import { describe, expect, it } from 'vitest'
import { viewFog } from './view-fog.js'

describe('viewFog', () => {
  it('is linear fog from the options, else from the lighting content, else none', () => {
    const content = { near: 4, far: 12, color: 0x2e222f }
    const options = { near: 6, far: 20, color: 0x3e3546 }
    expect(viewFog(options, content)).toEqual({ type: 'linear', near: 6, far: 20, color: 0x3e3546 })
    expect(viewFog(undefined, content)).toEqual({ type: 'linear', near: 4, far: 12, color: 0x2e222f })
    expect(viewFog(undefined, undefined)).toBeNull()
  })
})
