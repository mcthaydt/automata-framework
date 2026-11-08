import type { GameFile } from '@automata/editor/web-games'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// What a new game starts from. Until the tools' browser-safe `templateFiles` lands here, every starting point is a copy
// of the sample game: the editors it lists, a tuning file, and one file of each kind to change. The person owns the copy
// and can change or delete all of it; a level of their own starts from a template inside Levels 2D.
export function startingFiles(_startingPoint: string): readonly GameFile[] {
  return Object.entries(CONTENT_SAMPLE_GAME).map(([path, text]) => ({ path, text }))
}
