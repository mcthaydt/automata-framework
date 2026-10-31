/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_SlashInputs */

const en_key_slash = /** @type {(inputs: Key_SlashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Attack`)
};

/**
* | output |
* | --- |
* | "Attack" |
*
* @param {Key_SlashInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_slash = /** @type {((inputs?: Key_SlashInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_SlashInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_slash(inputs)
});