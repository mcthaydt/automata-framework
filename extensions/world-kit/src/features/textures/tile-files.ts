// Every committed tile file (library/tiles), imported by name so a browser bundle holds them: a test fails when this list and
// the folder differ. Regenerate by listing the folder.

import aggregateTile from '../../../library/tiles/aggregate.tile.json' with { type: 'json' }
import asphaltTile from '../../../library/tiles/asphalt.tile.json' with { type: 'json' }
import barBodyTile from '../../../library/tiles/barBody.tile.json' with { type: 'json' }
import barkTile from '../../../library/tiles/bark.tile.json' with { type: 'json' }
import baseCeilingTile from '../../../library/tiles/baseCeiling.tile.json' with { type: 'json' }
import baseFacadeTile from '../../../library/tiles/baseFacade.tile.json' with { type: 'json' }
import baseFloorTile from '../../../library/tiles/baseFloor.tile.json' with { type: 'json' }
import baseGroundTile from '../../../library/tiles/baseGround.tile.json' with { type: 'json' }
import baseKerbTile from '../../../library/tiles/baseKerb.tile.json' with { type: 'json' }
import basePrimTile from '../../../library/tiles/basePrim.tile.json' with { type: 'json' }
import baseRoadTile from '../../../library/tiles/baseRoad.tile.json' with { type: 'json' }
import baseWallTile from '../../../library/tiles/baseWall.tile.json' with { type: 'json' }
import beamCeilingTile from '../../../library/tiles/beamCeiling.tile.json' with { type: 'json' }
import brickDarkTile from '../../../library/tiles/brickDark.tile.json' with { type: 'json' }
import brickFlemishTile from '../../../library/tiles/brickFlemish.tile.json' with { type: 'json' }
import brickRedTile from '../../../library/tiles/brickRed.tile.json' with { type: 'json' }
import brickStackTile from '../../../library/tiles/brickStack.tile.json' with { type: 'json' }
import carpetRedTile from '../../../library/tiles/carpetRed.tile.json' with { type: 'json' }
import ceilingTile from '../../../library/tiles/ceiling.tile.json' with { type: 'json' }
import ceilingTileTile from '../../../library/tiles/ceilingTile.tile.json' with { type: 'json' }
import checkerFloorTile from '../../../library/tiles/checkerFloor.tile.json' with { type: 'json' }
import cobblesTile from '../../../library/tiles/cobbles.tile.json' with { type: 'json' }
import concreteWallTile from '../../../library/tiles/concreteWall.tile.json' with { type: 'json' }
import corrugatedTile from '../../../library/tiles/corrugated.tile.json' with { type: 'json' }
import crateWoodTile from '../../../library/tiles/crateWood.tile.json' with { type: 'json' }
import dadoBlueTile from '../../../library/tiles/dadoBlue.tile.json' with { type: 'json' }
import dadoGreenTile from '../../../library/tiles/dadoGreen.tile.json' with { type: 'json' }
import dadoOxbloodTile from '../../../library/tiles/dadoOxblood.tile.json' with { type: 'json' }
import dirtPathTile from '../../../library/tiles/dirtPath.tile.json' with { type: 'json' }
import doorOchreTile from '../../../library/tiles/doorOchre.tile.json' with { type: 'json' }
import doorRedTile from '../../../library/tiles/doorRed.tile.json' with { type: 'json' }
import doorTealTile from '../../../library/tiles/doorTeal.tile.json' with { type: 'json' }
import doorWhiteTile from '../../../library/tiles/doorWhite.tile.json' with { type: 'json' }
import doorWoodTile from '../../../library/tiles/doorWood.tile.json' with { type: 'json' }
import fabricKnitTile from '../../../library/tiles/fabricKnit.tile.json' with { type: 'json' }
import kerbStoneTile from '../../../library/tiles/kerbStone.tile.json' with { type: 'json' }
import laminateTile from '../../../library/tiles/laminate.tile.json' with { type: 'json' }
import linoTile from '../../../library/tiles/lino.tile.json' with { type: 'json' }
import metalPanelTile from '../../../library/tiles/metalPanel.tile.json' with { type: 'json' }
import metalSheetTile from '../../../library/tiles/metalSheet.tile.json' with { type: 'json' }
import oakTile from '../../../library/tiles/oak.tile.json' with { type: 'json' }
import oakFloorTile from '../../../library/tiles/oakFloor.tile.json' with { type: 'json' }
import panelOakTile from '../../../library/tiles/panelOak.tile.json' with { type: 'json' }
import panelPaintedTile from '../../../library/tiles/panelPainted.tile.json' with { type: 'json' }
import pavingSlabsTile from '../../../library/tiles/pavingSlabs.tile.json' with { type: 'json' }
import pineFloorTile from '../../../library/tiles/pineFloor.tile.json' with { type: 'json' }
import plasterPaintTile from '../../../library/tiles/plasterPaint.tile.json' with { type: 'json' }
import plasterWarmTile from '../../../library/tiles/plasterWarm.tile.json' with { type: 'json' }
import roofShinglesTile from '../../../library/tiles/roofShingles.tile.json' with { type: 'json' }
import rugFieldTile from '../../../library/tiles/rugField.tile.json' with { type: 'json' }
import runnerTile from '../../../library/tiles/runner.tile.json' with { type: 'json' }
import sidewalkTile from '../../../library/tiles/sidewalk.tile.json' with { type: 'json' }
import sidingBlueTile from '../../../library/tiles/sidingBlue.tile.json' with { type: 'json' }
import stoneWallTile from '../../../library/tiles/stoneWall.tile.json' with { type: 'json' }
import stuccoTile from '../../../library/tiles/stucco.tile.json' with { type: 'json' }
import tileBathTile from '../../../library/tiles/tileBath.tile.json' with { type: 'json' }
import tileFloorTile from '../../../library/tiles/tileFloor.tile.json' with { type: 'json' }
import tileKitchenTile from '../../../library/tiles/tileKitchen.tile.json' with { type: 'json' }
import tileWallTile from '../../../library/tiles/tileWall.tile.json' with { type: 'json' }
import wallpaperDamaskTile from '../../../library/tiles/wallpaperDamask.tile.json' with { type: 'json' }
import wallpaperSageTile from '../../../library/tiles/wallpaperSage.tile.json' with { type: 'json' }
import woodGrainTile from '../../../library/tiles/woodGrain.tile.json' with { type: 'json' }
import type { TileFile } from './tile-read.ts'

export const TILE_FILES: Readonly<Record<string, TileFile>> = {
  aggregate: aggregateTile as unknown as TileFile,
  asphalt: asphaltTile as unknown as TileFile,
  barBody: barBodyTile as unknown as TileFile,
  bark: barkTile as unknown as TileFile,
  baseCeiling: baseCeilingTile as unknown as TileFile,
  baseFacade: baseFacadeTile as unknown as TileFile,
  baseFloor: baseFloorTile as unknown as TileFile,
  baseGround: baseGroundTile as unknown as TileFile,
  baseKerb: baseKerbTile as unknown as TileFile,
  basePrim: basePrimTile as unknown as TileFile,
  baseRoad: baseRoadTile as unknown as TileFile,
  baseWall: baseWallTile as unknown as TileFile,
  beamCeiling: beamCeilingTile as unknown as TileFile,
  brickDark: brickDarkTile as unknown as TileFile,
  brickFlemish: brickFlemishTile as unknown as TileFile,
  brickRed: brickRedTile as unknown as TileFile,
  brickStack: brickStackTile as unknown as TileFile,
  carpetRed: carpetRedTile as unknown as TileFile,
  ceiling: ceilingTile as unknown as TileFile,
  ceilingTile: ceilingTileTile as unknown as TileFile,
  checkerFloor: checkerFloorTile as unknown as TileFile,
  cobbles: cobblesTile as unknown as TileFile,
  concreteWall: concreteWallTile as unknown as TileFile,
  corrugated: corrugatedTile as unknown as TileFile,
  crateWood: crateWoodTile as unknown as TileFile,
  dadoBlue: dadoBlueTile as unknown as TileFile,
  dadoGreen: dadoGreenTile as unknown as TileFile,
  dadoOxblood: dadoOxbloodTile as unknown as TileFile,
  dirtPath: dirtPathTile as unknown as TileFile,
  doorOchre: doorOchreTile as unknown as TileFile,
  doorRed: doorRedTile as unknown as TileFile,
  doorTeal: doorTealTile as unknown as TileFile,
  doorWhite: doorWhiteTile as unknown as TileFile,
  doorWood: doorWoodTile as unknown as TileFile,
  fabricKnit: fabricKnitTile as unknown as TileFile,
  kerbStone: kerbStoneTile as unknown as TileFile,
  laminate: laminateTile as unknown as TileFile,
  lino: linoTile as unknown as TileFile,
  metalPanel: metalPanelTile as unknown as TileFile,
  metalSheet: metalSheetTile as unknown as TileFile,
  oak: oakTile as unknown as TileFile,
  oakFloor: oakFloorTile as unknown as TileFile,
  panelOak: panelOakTile as unknown as TileFile,
  panelPainted: panelPaintedTile as unknown as TileFile,
  pavingSlabs: pavingSlabsTile as unknown as TileFile,
  pineFloor: pineFloorTile as unknown as TileFile,
  plasterPaint: plasterPaintTile as unknown as TileFile,
  plasterWarm: plasterWarmTile as unknown as TileFile,
  roofShingles: roofShinglesTile as unknown as TileFile,
  rugField: rugFieldTile as unknown as TileFile,
  runner: runnerTile as unknown as TileFile,
  sidewalk: sidewalkTile as unknown as TileFile,
  sidingBlue: sidingBlueTile as unknown as TileFile,
  stoneWall: stoneWallTile as unknown as TileFile,
  stucco: stuccoTile as unknown as TileFile,
  tileBath: tileBathTile as unknown as TileFile,
  tileFloor: tileFloorTile as unknown as TileFile,
  tileKitchen: tileKitchenTile as unknown as TileFile,
  tileWall: tileWallTile as unknown as TileFile,
  wallpaperDamask: wallpaperDamaskTile as unknown as TileFile,
  wallpaperSage: wallpaperSageTile as unknown as TileFile,
  woodGrain: woodGrainTile as unknown as TileFile,
}
