// `systems.agent`: an agent's entity. Its plan position is sectors' `InSector` (SY-D1); everything else it knows is its
// record in `systems.state`, because components hold only numbers.
import { type ComponentDef, defineComponent } from '@automata/sim'

const systemsAgentFields = {
  /** The agent's index in the loaded def's `agents`. */
  index: 'u32',
} as const

export const SystemsAgent: ComponentDef<typeof systemsAgentFields> = defineComponent(
  'systems.agent',
  systemsAgentFields,
)
