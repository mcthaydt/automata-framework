/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Hud_Boss_HealthInputs */

const en_hud_boss_health = /** @type {(inputs: Hud_Boss_HealthInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.name} health`)
};

/**
* | output |
* | --- |
* | "{name} health" |
*
* @param {Hud_Boss_HealthInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_boss_health = /** @type {((inputs: Hud_Boss_HealthInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_Boss_HealthInputs, { locale?: "en" }, {}>} */ ((inputs, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_boss_health(inputs)
});