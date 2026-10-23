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

  it('exports the level editor, the edits, the commands and what they are made of', () => {
    for (const name of [
      'createLevelEditor',
      'createViewStore',
      'initialView',
      'parseSelection',
      'ok',
      'refuse',
      'registerEditCommands',
      'addSector',
      'removeSector',
      'removeSectors',
      'duplicateSector',
      'setHeights',
      'setLight',
      'setMaterials',
      'moveCorner',
      'moveSector',
      'setWallKind',
      'setDoor',
      'setWindow',
      'setWallMaterial',
      'setWallFlags',
      'SectorAccessError',
      'inheritedMaterials',
      'portalReferences',
      'loopArea',
      'insideLoop',
      'insideOutline',
      'crossesItself',
      'outlineProblem',
    ]) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the facility editor, the World edits, the facility checks and the World selection ids', () => {
    for (const name of [
      'facilityChecks',
      'createFacilityEditor',
      'moveWing',
      'setJoin',
      'removeJoin',
      'setLock',
      'facilitySelection',
      'parseFacilitySelection',
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
      'levelOf',
      'reasonOf',
      'rect',
      'findImpurities',
      'round4',
      'holdSectors',
      'insertSector',
      'buildRefusal',
      'wallOver',
      'PORTAL_MEMBERS',
      'upserted',
      'joinSideProblem',
      'lockProblem',
      'sameJoinSide',
      'shippedFacility',
      'shippedFacilityText',
      'sameMember',
      'selectionOf',
    ]) {
      expect(editor3d, name).not.toHaveProperty(name)
    }
  })
})
