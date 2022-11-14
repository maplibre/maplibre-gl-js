import validateStyleMin from '../style-spec/validate_style.min';
import {ErrorEvent} from '../util/evented';

import type {Evented} from '../util/evented';
import validateGlyphsUrl from '../style-spec/validate/validate_glyphs_url';
import validateString from '../style-spec/validate/validate_string';

type ValidationError = {
    message: string;
    line: number;
    identifier?: string;
};

export type Validator = (a: any) => ReadonlyArray<ValidationError>;

type ValidateStyle = {
    source: Validator;
    layer: Validator;
    light: Validator;
    terrain: Validator;
    filter: Validator;
    paintProperty: Validator;
    layoutProperty: Validator;
    (b: any, a?: any | null): ReadonlyArray<ValidationError>;
};

export const validateStyle = (validateStyleMin as ValidateStyle);

export const validateSource = validateStyle.source;
export const validateLight = validateStyle.light;
export const validateTerrain = validateStyle.terrain;
export const validateFilter = validateStyle.filter;
export const validatePaintProperty = validateStyle.paintProperty;
export const validateLayoutProperty = validateStyle.layoutProperty;
export {validateString as validateSprite};
export {validateGlyphsUrl};

export function emitValidationErrors(
    emitter: Evented,
    errors?: ReadonlyArray<{
        message: string;
        identifier?: string;
    }> | null
): boolean {
    let hasErrors = false;
    if (errors && errors.length) {
        for (const error of errors) {
            emitter.fire(new ErrorEvent(new Error(error.message)));
            hasErrors = true;
        }
    }
    return hasErrors;
}
