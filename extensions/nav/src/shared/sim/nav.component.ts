// `nav.agent`: a walker that nav moves. Its plan position is sectors' `InSector` x and z; its route lives in
// `nav.routes`, because components hold only numbers.
import { type ComponentDef, defineComponent } from '@automata/sim'

const navAgentFields = {
  /** Walking speed in metres per second. */
  speed: 'f64',
} as const

export const NavAgent: ComponentDef<typeof navAgentFields> = defineComponent('nav.agent', navAgentFields)
