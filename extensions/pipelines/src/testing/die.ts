import { Effect } from 'effect'
import { runMain } from '../app/main.ts'

// A program that dies with a defect, as a bug in a command would (main.test.ts).
runMain(Effect.dieMessage('the command broke'), () => undefined)
