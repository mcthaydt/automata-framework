/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Menu_SettingsInputs */

const en_menu_settings = /** @type {(inputs: Menu_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Settings`)
};

/**
* | output |
* | --- |
* | "Settings" |
*
* @param {Menu_SettingsInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const menu_settings = /** @type {((inputs?: Menu_SettingsInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Menu_SettingsInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_menu_settings(inputs)
});