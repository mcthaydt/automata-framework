/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Lock_Mode_ToggleInputs */

const en_lock_mode_toggle = /** @type {(inputs: Lock_Mode_ToggleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Toggle`)
};

/**
* | output |
* | --- |
* | "Toggle" |
*
* @param {Lock_Mode_ToggleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const lock_mode_toggle = /** @type {((inputs?: Lock_Mode_ToggleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Lock_Mode_ToggleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_lock_mode_toggle(inputs)
});