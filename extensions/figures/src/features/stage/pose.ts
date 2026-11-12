import { cross, dot, normalize, sub, type V3 } from '../../lib/math';
import type { View } from '../figure/figure';

/**
 * The camera pose a scene is drawn under (docs/contract.md). FigureBuilder owns no camera: the host scene's camera
 * system supplies a pose each frame (@pmndrs/klipp, in EnvironmentBuilder and automata-framework), and a test or the
 * viewer supplies a fixed one, from `lookAt` or `gameplay`. A pose is read here and never changed.
 */

/** A camera's pose, passed in. */
export interface CameraPose {
  /** The eye and the camera's own axes (unit, orthogonal, right-handed: right × up is −fwd), in world metres: the
   * fields of EnvironmentBuilder's PCam. */
  eye: V3; right: V3; up: V3; fwd: V3;
  size: [w: number, h: number];  // screen pixels
  /** Perspective: the focal length in pixels, (w / 2) / tan(fov / 2), and the principal point (the frame's centre by
   * default). A figure `d` metres along `fwd` is drawn at `f / d` pixels per metre. */
  f?: number; cx?: number; cy?: number;
  /** Orthographic (the projection the cells are painted for, and the proof's): screen pixels per world metre. Set
   * exactly one of `f` and `pixelsPerMetre`. */
  pixelsPerMetre?: number;
}

/** Screen pixels per metre of a density-1 cell's texel: a D1 cell shows 2.6 m in 96 texels. */
const D1_TEXELS = 96 / 2.6;

/** A pose from an eye and the point it looks at (y up), for tests and the viewer. */
export function lookAt(eye: V3, target: V3, lens: { f: number } | { pixelsPerMetre: number }, size: [number, number]): CameraPose {
  const fwd = normalize(sub(target, eye)), right = normalize(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  return { eye, right, up, fwd, size, ...lens };
}

/** Throws an `Error` naming the field of a malformed pose: both or neither of `f` and `pixelsPerMetre`, an axis that is
 * not unit, two that are not orthogonal, a left-handed set, a size that is not two whole numbers of at least 1. */
export function checkPose(pose: CameraPose): void {
  const bad = (what: string): never => { throw new Error(`CameraPose: ${what}`); };
  if ((pose.f !== undefined) === (pose.pixelsPerMetre !== undefined)) bad('set exactly one of f and pixelsPerMetre');
  if (pose.f !== undefined && !(pose.f > 0)) bad('f must be above 0');
  if (pose.pixelsPerMetre !== undefined && !(pose.pixelsPerMetre > 0)) bad('pixelsPerMetre must be above 0');
  const axes = [['right', pose.right], ['up', pose.up], ['fwd', pose.fwd]] as const, tol = 1e-6;
  for (const [name, a] of axes) if (!(Math.abs(Math.hypot(...a) - 1) <= tol)) bad(`${name} is not a unit vector`);
  for (let i = 0; i < 3; i++) {
    const [an, a] = axes[i], [bn, b] = axes[(i + 1) % 3];
    if (!(Math.abs(dot(a, b)) <= tol)) bad(`${an} and ${bn} are not orthogonal`);
  }
  const c = cross(pose.right, pose.up);
  if (!(Math.abs(c[0] + pose.fwd[0]) <= tol && Math.abs(c[1] + pose.fwd[1]) <= tol && Math.abs(c[2] + pose.fwd[2]) <= tol)) bad('the axes are left-handed');
  if (!pose.size.every(n => Number.isInteger(n) && n >= 1)) bad('size must be two whole numbers of at least 1');
}

/** The view a figure at `at` is drawn under: the bearing of the eye round it and the pitch of `fwd` (figure.ts View).
 * Under perspective each figure has its own bearing from the eye (the same rule as view/camera.ts `viewFrom`); under an
 * orthographic pose every figure shares the bearing `fwd` gives. */
export function viewOf(pose: CameraPose, at: V3): View {
  const azimuth = pose.f !== undefined ? Math.atan2(pose.eye[0] - at[0], pose.eye[2] - at[2]) : Math.atan2(-pose.fwd[0], -pose.fwd[2]);
  return { azimuth, pitch: Math.asin(-pose.fwd[1]) };
}

/** Where a world point lands on screen (pixels, y down) and its distance `d` in metres along `fwd`. */
export function project(pose: CameraPose, p: V3): [x: number, y: number, d: number] {
  const q = sub(p, pose.eye), d = dot(q, pose.fwd), [w, h] = pose.size;
  if (pose.f !== undefined) return [(pose.cx ?? w / 2) + pose.f * dot(q, pose.right) / d, (pose.cy ?? h / 2) - pose.f * dot(q, pose.up) / d, d];
  const ppm = pose.pixelsPerMetre!;
  return [w / 2 + ppm * dot(q, pose.right), h / 2 - ppm * dot(q, pose.up), d];
}

/** Screen pixels per density-1 texel for a figure at `at`: its pixels per metre (`pixelsPerMetre`, or `f / d` for a
 * figure `d` metres along `fwd`) × 2.6 / 96. */
export function zoomOf(pose: CameraPose, at: V3): number {
  return (pose.pixelsPerMetre ?? pose.f! / project(pose, at)[2]) / D1_TEXELS;
}

/** The density a figure is painted at. At a whole zoom (to 1e-9, as a host's `pixelsPerMetre` need not round-trip), the
 * largest of 4, 2, 1 that divides it and is not above `max`, so the sprite's `scale` is `zoom / density`: zoom 4 draws
 * D4 at ×1, zoom 8 D4 at ×2, zoom 3 D1 at ×3. Between whole zooms, the largest of 4, 2, 1 not above the zoom or `max`.
 * Never under 1. */
export function densityFor(zoom: number, max = 4): 1 | 2 | 4 {
  const n = Math.round(zoom), whole = Math.abs(zoom - n) < 1e-9 && n >= 1;
  for (const d of [4, 2] as const) if (d <= max && (whole ? n % d === 0 : d <= zoom)) return d;
  return 1;
}

/** The Last Light's gameplay camera (mcthaydt/PixiJS3D_Experiment_001 at 92e6704): perspective, a vertical field of
 * view of 2·atan(12/50), pitched 30° down, 16 m from a look point 0.6 m above the floor, behind on +z, a 640×480
 * frame. There a D1 texel covers about 1.69 frame pixels and a D2 texel (the stage's default density) about 0.85. The
 * camera tilts 30°, but the stage paints its figures at the renders' pitch (`SPRITE_PITCH`, 18°), not the camera's. */
export const GAMEPLAY = {
  fov: 2 * Math.atan(12 / 50), pitch: 30 * Math.PI / 180, distance: 16, lookHeight: 0.6,
  size: [640, 480] as [640, 480],
};

/** The gameplay pose round a look point, at one of its eight 45° orbit steps (0 is behind on +z). `size` is the frame
 * (640×480 by default): the field of view stays, so a larger frame is a longer focal length, as a host that brings the
 * frame up to 1.2× or 2× would have it. */
export function gameplay(look: V3, orbit = 0, size: [number, number] = GAMEPLAY.size): CameraPose {
  const a = orbit * Math.PI / 4, { pitch, distance, fov } = GAMEPLAY, flat = distance * Math.cos(pitch);
  const eye: V3 = [look[0] + flat * Math.sin(a), look[1] + distance * Math.sin(pitch), look[2] + flat * Math.cos(a)];
  return lookAt(eye, look, { f: size[1] / 2 / Math.tan(fov / 2) }, [size[0], size[1]]);
}
