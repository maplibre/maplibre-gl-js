import {latest as styleSpec, validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import {ErrorEvent} from '../util/evented.ts';
import {warnOnce} from '../util/util.ts';

import type {ValidationError} from '@maplibre/maplibre-gl-style-spec';
import type {Evented} from '../util/evented.ts';
import type {StyleSetterOptions} from './style.ts';

/**
 * Validates a single part of a style, e.g. a source, a filter or a paint property.
 * The options it takes are the ones assembled by {@link validateAndEmit}.
 */
export type Validator = (options: any) => readonly ValidationError[];

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

/**
 * The spec reports a canvas source as an error, because a canvas cannot be described in a stylesheet.
 * Adding one through {@link Style.addSource} is supported though, and {@link Style.serialize} then
 * includes it, so re-validating the style on `setStyle` would flag a source the user added correctly.
 * The severity cannot tell the two apart -- only the identifier can -- so the error is dropped here.
 */
const CANVAS_SOURCE_IDENTIFIER = 'source.canvas';

/**
 * Emits everything a validator found, and reports whether any of it was severe enough to abort.
 *
 * Warnings are logged rather than emitted as errors: the style still renders, just not necessarily
 * as its author intended (e.g. a filter mixing deprecated syntax into an expression tree). Treating
 * them as errors would abort the whole style load and leave a blank map.
 * See https://github.com/maplibre/maplibre-style-spec/issues/1751
 *
 * @param emitter - the object to fire {@link ErrorEvent}s on
 * @param errors - what validation turned up, if anything
 * @returns whether validation failed, i.e. whether the caller should give up on the value
 */
export function emitValidationErrors(emitter: Evented, errors: readonly ValidationError[]): boolean {
    let hasErrors = false;
    for (const error of errors) {
        if (error.identifier === CANVAS_SOURCE_IDENTIFIER) {
            continue;
        }
        if (error.severity === 'warning') {
            warnOnce(error.message);
            continue;
        }
        emitter.fire(new ErrorEvent(new Error(error.message)));
        hasErrors = true;
    }
    return hasErrors;
}

/**
 * Runs a validator over a value and emits whatever it finds.
 *
 * @param emitter - the object to fire {@link ErrorEvent}s on
 * @param validator - the validator to run, e.g. {@link validateFilter}
 * @param params - what to validate: the `value`, plus whatever context the validator needs, such as
 * the `key` locating it in the style, or the surrounding `style` that {@link validateStyle.layer} looks at
 * @param options - setter options; validation is skipped entirely when `validate` is `false`
 * @returns whether validation failed, i.e. whether the caller should give up on the value
 */
export function validateAndEmit(
    emitter: Evented,
    validator: Validator,
    params: {value: unknown} & Record<string, unknown>,
    options?: StyleSetterOptions
): boolean {
    if (options?.validate === false) {
        return false;
    }
    return emitValidationErrors(emitter, validator({
        styleSpec,
        ...params
    }));
}
