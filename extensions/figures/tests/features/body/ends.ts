import { DEFAULT_SLIDERS, type HeadShape, type Sliders } from '../../../src/features/body/genes';

/**
 * The slider ends every "at every slider end" test loops over (sliders.test.ts and the c3-cloth tests): each slider of
 * the base pair pushed to either end of its range (0 and 1; the height to 150 and 200 cm; the head's tilt to ±10°).
 */
export const ENDS: Partial<Record<keyof Sliders, [number, number]>> = { height: [150, 200], headTilt: [-10, 10], bodyAsymmetry: [-1, 1] };
export const BODY = (Object.keys(DEFAULT_SLIDERS) as (keyof Sliders)[]).filter(k => typeof DEFAULT_SLIDERS[k] === 'number');
/** The signed face sliders (the sign picks the side) run −1…1. */
export const FACE_ENDS: Partial<Record<keyof HeadShape, [number, number]>> = { asymmetry: [-1, 1] };
/** A slider's two ends. */
export const endsOf = (key: keyof Sliders): [number, number] => ENDS[key] ?? [0, 1];
