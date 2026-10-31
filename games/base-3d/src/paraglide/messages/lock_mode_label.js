/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Lock_Mode_LabelInputs */

const en_lock_mode_label = /** @type {(inputs: Lock_Mode_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Lock mode`)
};

/**
* | output |
* | --- |
* | "Lock mode" |
*
* @param {Lock_Mode_LabelInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const lock_mode_label = /** @type {((inputs?: Lock_Mode_LabelInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Lock_Mode_LabelInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_lock_mode_label(inputs)
});