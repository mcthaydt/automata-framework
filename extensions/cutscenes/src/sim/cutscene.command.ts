// Skipping (M6 spec §4.8, §5): the one command a cutscene takes. It ends the cutscene under way and resumes input.
import { type CommandDef, defineCommand } from '@mcthaydt/automata-sim'
import { z } from 'zod'

export const CutsceneSkip: CommandDef<z.ZodType<Record<string, never>>> = defineCommand(
  'cutscene.skip',
  z.strictObject({}),
)
