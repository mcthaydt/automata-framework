// The Party Racer's race sim (PRODUCT.8b): FloorFifty's race, one mode, on Rapier 2D. Held to the framework's sim
// boundaries (`pnpm boundaries`): no I/O, no clock, no Math.random.

export { type ContactFact, racerContacts } from './contacts'
export { type Course, type CourseFloor, courseBounds, createCourse } from './course.generator'
export { Floor } from './floor.component'
export { RaceInput, RaceReset, RaceStart } from './race.command'
export { FloorLanded, LapCompleted, RaceFinished, RacerReset } from './race.event'
export { racePlugins } from './race.plugin'
export { Race } from './race.resource'
export { HeldInput, Racer } from './racer.component'
export { type RaceTuning, raceTuningSchema } from './tuning.schema'
