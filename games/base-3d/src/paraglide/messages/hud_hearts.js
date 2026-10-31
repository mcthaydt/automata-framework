/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ health: NonNullable<unknown>, max: NonNullable<unknown> }} Hud_HeartsInputs */

const en_hud_hearts = /** @type {(inputs: Hud_HeartsInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Hearts ${i?.health} of ${i?.max}`)
};

/**
* | output |
* | --- |
* | "Hearts {health} of {max}" |
*
* @param {Hud_HeartsInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_hearts = /** @type {((inputs: Hud_HeartsInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_HeartsInputs, { locale?: "en" }, {}>} */ ((inputs, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_hearts(inputs)
});