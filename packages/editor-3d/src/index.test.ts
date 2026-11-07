// The package's public entry: what a consumer can import, and what stays inside.

import { cameraView } from '@automata/3d/camera-view'
import { describe, expect, it } from 'vitest'
import * as editor3d from './index'

describe('public entry', () => {
  it('exports the codecs, the schemas, the profiles and the registry, patchJson, scan, the geometry queries and the checks', () => {
    for (const name of [
      'createFileCodec',
      'patchJson',
      'scan',
      'readLayout',
      'insertElement',
      'resolveMap',
      'sectorAt',
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
      'setView',
      'moveCorner',
      'moveSector',
      'setWallKind',
      'setDoor',
      'setWindow',
      'setWallMaterial',
      'setWallOcclude',
      'setWallFlags',
      'addThing',
      'moveThing',
      'setThingField',
      'removeThing',
      'SectorAccessError',
      'ThingAccessError',
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

  it('exports the materials, the material picker and the Walk controller (ED3D.8a)', () => {
    for (const name of ['applyMaterial', 'materialOf', 'createMaterialPicker', 'createWalkController']) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the definition edits, the af-sector materials-table edits and the new-level template', () => {
    for (const name of [
      'addDefinition',
      'renameDefinition',
      'setDefinitionField',
      'removeDefinition',
      'addMaterial',
      'setMaterial',
      'renameMaterial',
      'removeMaterial',
      'newAfSectorLevel',
    ]) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it("exports the entity model: the definition, the reader and both formats' kits", () => {
    for (const name of [
      'thingDefSchema',
      'THING_SHAPES',
      'THING_SITS',
      'RESERVED_FIELD_IDS',
      'readEntityKit',
      'afEntityKit',
    ]) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the entity checks: the values, places and single definitions, and the refs', () => {
    for (const name of ['entityProblems', 'entityRefProblems']) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the check that takes the game’s list of materials', () => {
    for (const name of ['materialProblems']) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the view core: the plan, the meshes, the camera and what they pick', () => {
    for (const name of [
      'selectionOf',
      'PLAN_PX_PER_M',
      'PLAN_LIMITS',
      'planViewport',
      'cameraOf',
      'toScreen',
      'toWorld',
      'levelBounds',
      'fitPlan',
      'gridStep',
      'gridLines',
      'snapStep',
      'snapValue',
      'planScene',
      'PICK_RADIUS',
      'pickPlan',
      'pickCorner',
      'snapPlan',
      'triangulate',
      'buildSectorMesh',
      'faceShade',
      'EMPTY_BOUNDS',
      'ORBIT_FOV',
      'WALK_FOV',
      'WALK_EYE_HEIGHT',
      'forward',
      'projectPoint',
      'rayThrough',
      'orbitCamera',
      'orbitBy',
      'fitOrbit',
      'HOME_YAW',
      'walkCamera',
      'walkStart',
      'facesEye',
      'visibleSurfaces',
      'surfaceVisibility',
      'pickMesh',
      'OCCLUDES',
    ]) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the free heading, in the game’s turn units, and not the eight-heading preview it replaces', () => {
    for (const name of [
      'DEGREES_PER_PIXEL',
      'dragTurn',
      'headingToYaw',
      'yawToHeading',
      'headingToDeg',
      'wallsSeenFrom',
      'headingView',
      'headingSweep',
    ])
      expect(editor3d, name).toHaveProperty(name)
    for (const name of ['HEADINGS', 'headingPreview']) expect(editor3d, name).not.toHaveProperty(name)
    // The heading's own maths has one owner, @automata/3d's `./camera-view` (M3 spec §4.2, amended 2026-10-30).
    for (const name of ['TURN_UNITS', 'wrapHeading', 'turnHeading', 'degToHeading'])
      expect(editor3d, name).not.toHaveProperty(name)
  })

  it('exports the follow camera of a room and the camera the game puts on a player, on the owner’s camera-view', () => {
    for (const name of ['followCamera', 'roomView']) expect(editor3d, name).toHaveProperty(name)
    // `camera-view` has one owner, @automata/3d's `./camera-view` (M3 spec §4.2, amended 2026-10-30): the editor
    // keeps no copy of the view's shape, defaults or ranges.
    for (const name of ['CAMERA_DEFAULTS', 'CAMERA_RANGES', 'cameraViewSpec'])
      expect(editor3d, name).not.toHaveProperty(name)
    const room = editor3d.roomView(
      { surfaces: [], bounds: editor3d.EMPTY_BOUNDS } as unknown as Parameters<typeof editor3d.roomView>[0],
      cameraView('hall'),
      [0, 0, 0],
    )
    const view: Pick<editor3d.RoomView, 'rotate'> = { rotate: room.rotate }
    expect(view.rotate).toBe(true)
  })

  it('exports the plan controller', () => {
    expect(editor3d).toHaveProperty('createPlanController')
  })

  it('exports the sector tool and the portal offers it makes', () => {
    for (const name of ['createSectorTool', 'portalOffers']) expect(editor3d, name).toHaveProperty(name)
    // The shapes are a type, so this is checked by the compiler: the entry names them.
    const shapes: editor3d.SectorShape[] = ['polygon', 'rectangle']
    expect(shapes).toHaveLength(2)
  })

  it('keeps the facility editor and the Last Light checks out: the editor opens af-sector levels only', () => {
    for (const name of ['facilityChecks', 'createFacilityEditor', 'moveWing', 'lastLightChecks', 'navWorld'])
      expect(editor3d, name).not.toHaveProperty(name)
  })

  it('exports the wall tools and what one wall can be offered, and keeps the geometry cache inside', () => {
    for (const name of ['createWallTool', 'wallPortal']) expect(editor3d, name).toHaveProperty(name)
    expect(editor3d).not.toHaveProperty('createGeometryCache')
  })

  it('exports the vertex edits and the Vertex tool', () => {
    for (const name of ['insertCorner', 'removeCorner', 'createVertexTool'])
      expect(editor3d, name).toHaveProperty(name)
    // The targets are a type, so this is checked by the compiler: the entry names them.
    const effects: editor3d.VertexEffect[] = [{ action: 'add' }, { action: 'none', reason: 'no' }]
    expect(effects).toHaveLength(2)
  })

  it('exports the Things tool, the thing pick and the name of a sub-layer', () => {
    for (const name of ['createThingsTool', 'pickThing', 'isThingLayerOff', 'thingLayer'])
      expect(editor3d, name).toHaveProperty(name)
    // The views are types, so this is checked by the compiler: the entry names them.
    const place: editor3d.ThingPlace = { x: 1, z: 2, id: 'crate2', action: 'none', reason: 'no' }
    const entry: editor3d.PaletteEntry['layer'] = editor3d.thingLayer('crate')
    expect([place.id, entry]).toEqual(['crate2', 'things:crate'])
  })

  it('exports the link edits, and the rectangle and link of the Things tool', () => {
    for (const name of ['addLink', 'removeLink']) expect(editor3d, name).toHaveProperty(name)
    // The shapes are types, so this is checked by the compiler: the entry names them.
    const link: editor3d.ThingLink = { a: 'p', b: 'q', via: 'door' }
    const area: editor3d.Rectangle = { x0: 0, z0: 0, x1: 1, z1: 1 }
    const place: editor3d.LinkPlace = { ...link, action: 'add' }
    expect([place.a, area.x1]).toEqual(['p', 1])
  })

  it('exports the Split and Merge edits, and keeps the helpers they share inside', () => {
    for (const name of ['splitSector', 'mergeSectors']) expect(editor3d, name).toHaveProperty(name)
    for (const name of ['retargetPortals', 'redirectPortals', 'cornerInserted', 'reversedLoop'])
      expect(editor3d, name).not.toHaveProperty(name)
    // The arguments are types, so this is checked by the compiler: the entry names them.
    const split: editor3d.SplitSectorArgs = { sector: 'a', id: 'b', from: { x: 0, z: 0 }, to: { x: 1, z: 1 } }
    const merge: editor3d.MergeSectorsArgs = { keep: 'a', merge: 'b' }
    expect([split.id, merge.keep]).toEqual(['b', 'a'])
  })

  it('exports the checks panel and the Ask', () => {
    for (const name of ['createChecksPanel', 'createAsk']) {
      expect(editor3d, name).toHaveProperty(name)
    }
  })

  it('exports the app core: the editor app and the size limit, and keeps the storage steps inside', () => {
    for (const name of ['createEditorApp', 'MAX_FILE_BYTES']) expect(editor3d, name).toHaveProperty(name)
    for (const name of ['createPatchedDocument', 'readLevel', 'listProjects', 'importZip', 'readStored'])
      expect(editor3d, name).not.toHaveProperty(name)
    // The outcomes are types, so this is checked by the compiler: the entry names them.
    const refused: editor3d.PatchRefused = {
      status: 'refused',
      path: [],
      reason: 'verify-failed',
      detail: 'no',
    }
    const skipped: editor3d.Skipped = { path: 'a', reason: 'system' }
    expect([refused.status, skipped.reason]).toEqual(['refused', 'system'])
  })

  it('exports the Split and Merge tools, and keeps what the tools share inside', () => {
    for (const name of ['createSplitTool', 'createMergeTool']) expect(editor3d, name).toHaveProperty(name)
    for (const name of ['cutProblem', 'lowestFreeId', 'outlinePlaceAt', 'wallPlaceOf'])
      expect(editor3d, name).not.toHaveProperty(name)
    // The views and targets are types, so this is checked by the compiler: the entry names them.
    const split: editor3d.SplitEffect[] = [
      { action: 'start' },
      { action: 'cut' },
      { action: 'none', reason: 'no' },
    ]
    const merge: editor3d.MergeEffect[] = [
      { action: 'keep' },
      { action: 'merge' },
      { action: 'none', reason: 'no' },
    ]
    const target: editor3d.SplitTarget = {
      kind: 'corner',
      sector: 'a',
      corner: 0,
      point: { x: 0, z: 0 },
      action: 'start',
    }
    const place: editor3d.OutlinePlace = target
    expect([split.length, merge.length, place.kind]).toEqual([3, 3, 'corner'])
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
      'fakeAskProvider',
      'deferred',
      'problemCount',
      // The view core's own helpers: the vector arithmetic and the shared picking parts.
      'cross',
      'dot',
      'unit',
      'wallNear',
      'isLayerOff',
      'stepOf',
      // Each profile's list and their shared hints are read through the profile.
      'afMaterials',
      'lastLightMaterials',
      'SECTOR_HINTS',
    ]) {
      expect(editor3d, name).not.toHaveProperty(name)
    }
  })
})
