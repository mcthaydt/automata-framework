/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown>, total: NonNullable<unknown> }} Hud_EmbersInputs */

const en_hud_embers = /** @type {(inputs: Hud_EmbersInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Embers ${i?.count} of ${i?.total}`)
};

/**
* | output |
* | --- |
* | "Embers {count} of {total}" |
*
* @param {Hud_EmbersInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_embers = /** @type {((inputs: Hud_EmbersInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_EmbersInputs, { locale?: "en" }, {}>} */ ((inputs, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_embers(inputs)
});