// @automata/hud/content: the `hud` file's kind and schema, for Node tools that read content (they never load the pieces).
export { hudContent } from '../shared/hud.content'
export { type HudFile, hudSchema } from '../shared/hud.schema'
export {
  HUD_ANCHORS,
  HUD_PIECE_KINDS,
  type HudAnchor,
  type HudLayout,
  type HudPiece,
  type HudPieceKind,
} from '../shared/layout.schema'
export { chooseObjective, type ObjectiveRow } from '../shared/objective'
