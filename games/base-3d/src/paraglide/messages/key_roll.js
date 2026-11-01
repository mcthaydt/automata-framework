/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_RollInputs */

const en_key_roll = /** @type {(inputs: Key_RollInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Roll`)
};

/**
* | output |
* | --- |
* | "Roll" |
*
* @param {Key_RollInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_roll = /** @type {((inputs?: Key_RollInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_RollInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_roll(inputs)
});