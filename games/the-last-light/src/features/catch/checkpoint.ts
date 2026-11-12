import { PuzzleState } from '@automata/puzzle/sim'
import { InSector } from '@automata/sectors/sim'
import type { SimContext } from '@automata/sim'
import { CarriedLight } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { Checkpoint } from './checkpoint.resource.ts'

/** Keeps the checkpoint now: the puzzle's facts and items, where Ada stands, and her lamp. */
export function saveCheckpoint(ctx: SimContext): void {
  const state = ctx.resource(PuzzleState)
  const [ada] = ctx.query(Ada, InSector)
  const light = ctx.query(CarriedLight)[0]?.get(CarriedLight)
  const checkpoint = ctx.resource(Checkpoint)
  checkpoint.saved = true
  checkpoint.pending = false
  checkpoint.facts = { ...state.facts } as typeof checkpoint.facts
  checkpoint.items = [...state.items]
  checkpoint.ada = ada === undefined ? { x: 0, z: 0 } : { x: ada.get(InSector).x, z: ada.get(InSector).z }
  checkpoint.lamp = light === undefined ? null : { lit: light.lit, fuelTicks: light.fuelTicks }
}
