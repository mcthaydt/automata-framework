import type { Gait, Seat, Stand } from './motion';
import gaitLibrary from './library/gaits.json';
import poseLibrary from './library/poses.json';
import seatLibrary from './library/seats.json';
/**
 * The motion presets a character names (library/*.json): its gait (GAITS: how it walks, stands and breathes, which a
 * character file picks by name and may adjust) and the lookbook stands (POSES: a pose held standing, its hands placed
 * at the outfit's openings, or the body's own hip where it has none), and the seated stands (SEATS: a seat's height and
 * lean, where the hands rest; motion.ts seated).
 */
export const GAITS = gaitLibrary as Record<string, Gait>;
export const POSES = poseLibrary as unknown as Record<string, Stand>;
/** Seated stands a fork's code or an actor's pose picks by name (library/seats.json; motion.ts seated). */
export const SEATS = seatLibrary as unknown as Record<string, Seat>;
