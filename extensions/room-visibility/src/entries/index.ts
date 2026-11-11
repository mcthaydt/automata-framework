// @automata/room-visibility: rooms, camera zones and cutaway walls for AF's angled-camera 3D levels. This entry is the
// data and the rules, with no renderer in it; the 3D masks are `@automata/room-visibility/view`.
export {
  type PlanPoint,
  plansOf,
  type RoomCorner,
  type RoomLevel,
  type RoomPlan,
  type RoomSector,
  type RoomWall,
} from '../features/room-visibility/room-level.ts'
export {
  checkRoomPolicy,
  parseRoomPolicy,
  type RoomFacts,
  type RoomOwners,
  type RoomPolicy,
  type RoomPolicyProblem,
  roomPolicySchema,
} from '../features/room-visibility/room-policy.schema.ts'
export {
  createRoomVisibility,
  type RoomVisibility,
  type RoomVisibilityInput,
  ZONE_HOLD,
} from '../features/room-visibility/room-resolver.ts'
export {
  hiddenWallGroups,
  type WallEdge,
  type WallGroup,
  type WallPiece,
  wallGroupAt,
  wallGroupOfPiece,
  wallGroups,
  wallRoomOwners,
} from '../features/room-visibility/wall-groups.ts'
