/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Splash_MarkInputs */

const en_splash_mark = /** @type {(inputs: Splash_MarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AutomataFramework`)
};

/**
* | output |
* | --- |
* | "AutomataFramework" |
*
* @param {Splash_MarkInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const splash_mark = /** @type {((inputs?: Splash_MarkInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Splash_MarkInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_splash_mark(inputs)
});