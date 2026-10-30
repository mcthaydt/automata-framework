import { describe, expect, it } from 'vitest'

// The Plan view's renderer in Chromium with WebGL2 (plan ED3D.5d step 3). Step 1 only proves the project runs Pixi.

describe('the canvas project', () => {
  it('loads Pixi in a browser with WebGL2', async () => {
    const pixi = await import('pixi.js')
    expect(typeof pixi.Application).toBe('function')
    expect(document.createElement('canvas').getContext('webgl2')).not.toBeNull()
  })
})
