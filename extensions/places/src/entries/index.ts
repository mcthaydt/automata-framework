// @automata/places: where things are, as one small contract. Types and pure helpers only; the answers come from
// `sectors` (3D rooms) or `level-2d` (2D areas and walls).
export {
  type Blocked,
  blockedWith,
  crossingThrough,
  type Places,
  type PlanCrossing,
  type PlanPoint,
  type PlanRoom,
  THROUGH,
} from '../shared/places.ts'
