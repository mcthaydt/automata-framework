import { describe, expect, it } from 'vitest'
import { findRukenSdkMarkers, RUKEN_SDK_MARKERS } from '#src/sdk-markers.ts'
import { WEB_STORAGE_PROBE_KEY } from '#src/web/hosting-web.ts'

describe("the Ruken SDK's bundle markers (PUB spec §3)", () => {
  it('are the two SDK string literals that survive minification', () => {
    expect(RUKEN_SDK_MARKERS).toEqual(['ruken:__probe__', 'needs the Ruken host'])
  })

  it('finds each marker in minified code, once per marker', () => {
    const minified =
      'const k="ruken:__probe__";s.setItem(k,"1");const u=w=>Promise.reject(new E("UNSUPPORTED",w+" needs the Ruken host"));'
    expect(findRukenSdkMarkers(minified)).toEqual(['ruken:__probe__', 'needs the Ruken host'])
    expect(findRukenSdkMarkers('x="needs the Ruken host";y="needs the Ruken host"')).toEqual([
      'needs the Ruken host',
    ])
  })

  it("finds nothing in code without the SDK, including the web adapter's own probe key", () => {
    expect(
      findRukenSdkMarkers(`const k=${JSON.stringify(WEB_STORAGE_PROBE_KEY)};const p="ruken:my-game:";`),
    ).toEqual([])
  })
})
