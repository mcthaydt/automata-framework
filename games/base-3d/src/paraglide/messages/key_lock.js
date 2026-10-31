/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_LockInputs */

const en_key_lock = /** @type {(inputs: Key_LockInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Lock`)
};

/**
* | output |
* | --- |
* | "Lock" |
*
* @param {Key_LockInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_lock = /** @type {((inputs?: Key_LockInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_LockInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_lock(inputs)
});