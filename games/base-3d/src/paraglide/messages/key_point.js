/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_PointInputs */

const en_key_point = /** @type {(inputs: Key_PointInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Point`)
};

/**
* | output |
* | --- |
* | "Point" |
*
* @param {Key_PointInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_point = /** @type {((inputs?: Key_PointInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_PointInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_point(inputs)
});