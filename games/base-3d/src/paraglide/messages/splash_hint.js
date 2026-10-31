/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Splash_HintInputs */

const en_splash_hint = /** @type {(inputs: Splash_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Press any key or tap`)
};

/**
* | output |
* | --- |
* | "Press any key or tap" |
*
* @param {Splash_HintInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const splash_hint = /** @type {((inputs?: Splash_HintInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Splash_HintInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_splash_hint(inputs)
});