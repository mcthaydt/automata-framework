// The package's public entry: what a consumer can import, and what stays inside.
import { describe, expect, it } from 'vitest'
import * as editor3d from './index'

describe('public entry', () => {
  it('exports the codecs, the schemas, the profiles and the registry, expand, patchJson, scan, the geometry queries and the checks', () => {
    for (const name of [
      'blockoutCodec',
      'facilityCodec',
      'createFileCodec',
      'blockoutSchema',
      'facilitySchema',
      'expand',
      'patchJson',
      'scan',
      'readLayout',
      'insertElement',
      'resolveMap',
      'sectorAt',
      'navWorld',
      'clear',
      'openDoors',
      'lastLightChecks',
      'genericChecks',
      'checkResult',
      'entitySelection',
      'wallSelection',
      'sectorSelection',
      'AF_SECTOR_FORMAT',
      'afFormatVersion',
      'afSectorSchema',
      'afSectorCodec',
      'afIdProblems',
      'afSectorChecks',
      'buildSectors',
      'AfBuildError',
      'wallLocator',
      'GeometryError',
      'lastLightProfile',
      'afSectorProfile',
      'profiles',
      'detectProfile',
    ]) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('keeps test helpers and the verification guard out', () => {
    for (const name of [
      'loadFixture',
      'loadGolden',
      'FIXTURE_NAMES',
      'changedRegion',
      'verifyPatched',
      'navShape',
      'room',
      'plainContext',
      'toyBlockout',
      'loadCheckCases',
      'loadChecksGolden',
      'loadAuthored',
      'AUTHORED_NAMES',
      'toyAfSector',
      'resolveOrThrow',
      'roomsProblem',
    ]) {
      expect(editor3d, name).not.toHaveProperty(name)
    }
  })
})
