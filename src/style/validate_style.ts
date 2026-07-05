import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import {ErrorEvent} from '../util/evented.ts';

import type {Evented} from '../util/evented.ts';

type ValidationError = {
    message: string;
    line: number;
    identifier?: string;
};

export type Validator = (a: any) => readonly ValidationError[];

type ValidateStyle = {
    source: Validator;
    sprite: Validator;
    glyphs: Validator;
    layer: Validator;
    light: Validator;
    sky: Validator;
    terrain: Validator;
    filter: Validator;
    paintProperty: Validator;
    layoutProperty: Validator;
    (b: any, a?: any | null): readonly ValidationError[];
};

export const validateStyle = (validateStyleMin as unknown as ValidateStyle);

export const validateSource: Validator = validateStyle.source;
export const validateLight: Validator = validateStyle.light;
export const validateSky: Validator = validateStyle.sky;
export const validateTerrain: Validator = validateStyle.terrain;
export const validateFilter: Validator = validateStyle.filter;
export const validatePaintProperty: Validator = validateStyle.paintProperty;
export const validateLayoutProperty: Validator = validateStyle.layoutProperty;

export function emitValidationErrors(
    emitter: Evented,
    errors?: ReadonlyArray<{
        message: string;
        identifier?: string;
    }> | null
): boolean {
    let hasErrors = false;
    if (errors?.length) {
        for (const error of errors) {
            emitter.fire(new ErrorEvent(new Error(error.message)));
            hasErrors = true;
        }
    }
    return hasErrors;
}
