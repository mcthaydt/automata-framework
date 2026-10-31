/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Lock_Mode_HoldInputs */

const en_lock_mode_hold = /** @type {(inputs: Lock_Mode_HoldInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hold`)
};

/**
* | output |
* | --- |
* | "Hold" |
*
* @param {Lock_Mode_HoldInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const lock_mode_hold = /** @type {((inputs?: Lock_Mode_HoldInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Lock_Mode_HoldInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_lock_mode_hold(inputs)
});