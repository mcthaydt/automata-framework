/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_GuardInputs */

const en_key_guard = /** @type {(inputs: Key_GuardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Shield`)
};

/**
* | output |
* | --- |
* | "Shield" |
*
* @param {Key_GuardInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_guard = /** @type {((inputs?: Key_GuardInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_GuardInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_guard(inputs)
});