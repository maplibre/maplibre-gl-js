import assert from 'assert';

import TransferableGridIndex from './transferable_grid_index';
import Color from '../style-spec/util/color';
import {StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '../style-spec/expression';
import CompoundExpression from '../style-spec/expression/compound_expression';
import expressions from '../style-spec/expression/definitions';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import {AJAXError} from './ajax';

import type {Transferable} from '../types/transferable';
import {isImageBitmap} from './util';

type SerializedObject = {
    [_: string]: Serialized;
}; // eslint-disable-line

export type Serialized = null | void | boolean | number | string | Boolean | Number | String | Date | RegExp | ArrayBuffer | ArrayBufferView | ImageData | ImageBitmap | Blob | Array<Serialized> | SerializedObject;

type Registry = {
    [_: string]: {
        klass: {
            new (...args: any): any;
            deserialize?: (input: Serialized) => unknown;
        };
        omit: ReadonlyArray<string>;
        shallow: ReadonlyArray<string>;
    };
};

type RegisterOptions<T> = {
    omit?: ReadonlyArray<keyof T>;
    shallow?: ReadonlyArray<keyof T>;
};

const registry: Registry = {};

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization (e.g., cached/computed properties)
 * @param options.shallow List of properties that should be serialized by a simple shallow copy, rather than by a recursive call to serialize().
 *
 * @private
 */
export function register<T extends any>(
    name: string,
    klass: {
        new (...args: any): T;
    },
    options: RegisterOptions<T> = {}
) {
    assert(!registry[name], `${name} is already registered.`);
    ((Object.defineProperty as any))(klass, '_classRegistryKey', {
        value: name,
        writeable: false
    });
    registry[name] = {
        klass,
        omit: options.omit as ReadonlyArray<string> || [],
        shallow: options.shallow as ReadonlyArray<string> || []
    };
}

register('Object', Object);
register('TransferableGridIndex', TransferableGridIndex);

register('Color', Color);
register('Error', Error);
register('AJAXError', AJAXError);
register('ResolvedImage', ResolvedImage);

register('StylePropertyFunction', StylePropertyFunction);
register('StyleExpression', StyleExpression, {omit: ['_evaluator']});

register('ZoomDependentExpression', ZoomDependentExpression);
register('ZoomConstantExpression', ZoomConstantExpression);
register('CompoundExpression', CompoundExpression, {omit: ['_evaluate']});
for (const name in expressions) {
    if ((expressions[name] as any)._classRegistryKey) continue;
    register(`Expression_${name}`, expressions[name]);
}

function isArrayBuffer(value: any): value is ArrayBuffer {
    return value && typeof ArrayBuffer !== 'undefined' &&
           (value instanceof ArrayBuffer || (value.constructor && value.constructor.name === 'ArrayBuffer'));
}

/**
 * Serialize the given object for transfer to or from a web worker.
 *
 * For non-builtin types, recursively serialize each property (possibly
 * omitting certain properties - see register()), and package the result along
 * with the constructor's `name` so that the appropriate constructor can be
 * looked up in `deserialize()`.
 *
 * If a `transferables` array is provided, add any transferable objects (i.e.,
 * any ArrayBuffers or ArrayBuffer views) to the list. (If a copy is needed,
 * this should happen in the client code, before using serialize().)
 *
 * @private
 */
export function serialize(input: unknown, transferables?: Array<Transferable> | null): Serialized {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof Blob) {
        return input;
    }

    if (isArrayBuffer(input)) {
        if (transferables) {
            transferables.push(input);
        }
        return input;
    }

    if (isImageBitmap(input)) {
        if (transferables) {
            transferables.push(input);
        }
        return input;
    }

    if (ArrayBuffer.isView(input)) {
        const view = input;
        if (transferables) {
            transferables.push(view.buffer);
        }
        return view;
    }

    if (input instanceof ImageData) {
        if (transferables) {
            transferables.push(input.data.buffer);
        }
        return input;
    }

    if (Array.isArray(input)) {
        const serialized: Array<Serialized> = [];
        for (const item of input) {
            serialized.push(serialize(item, transferables));
        }
        return serialized;
    }

    if (typeof input === 'object') {
        const klass = (input.constructor as any);
        const name = klass._classRegistryKey;
        if (!name) {
            throw new Error('can\'t serialize object of unregistered class');
        }
        assert(registry[name]);

        const properties: SerializedObject = klass.serialize ?
            // (Temporary workaround) allow a class to provide static
            // `serialize()` and `deserialize()` methods to bypass the generic
            // approach.
            // This temporary workaround lets us use the generic serialization
            // approach for objects whose members include instances of dynamic
            // StructArray types. Once we refactor StructArray to be static,
            // we can remove this complexity.
            (klass.serialize(input, transferables) as SerializedObject) : {};

        if (!klass.serialize) {
            for (const key in input) {
                // any cast due to https://github.com/facebook/flow/issues/5393
                if (!(input as any).hasOwnProperty(key)) continue; // eslint-disable-line no-prototype-builtins
                if (registry[name].omit.indexOf(key) >= 0) continue;
                const property = (input as any)[key];
                properties[key] = registry[name].shallow.indexOf(key) >= 0 ?
                    property :
                    serialize(property, transferables);
            }
            if (input instanceof Error) {
                properties.message = input.message;
            }
        } else {
            // make sure statically serialized object survives transfer of $name property
            assert(!transferables || properties as any !== transferables[transferables.length - 1]);
        }

        if (properties.$name) {
            throw new Error('$name property is reserved for worker serialization logic.');
        }
        if (name !== 'Object') {
            properties.$name = name;
        }

        return properties;
    }

    throw new Error(`can't serialize object of type ${typeof input}`);
}

export function deserialize(input: Serialized): unknown {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof Blob ||
        isArrayBuffer(input) ||
        isImageBitmap(input) ||
        ArrayBuffer.isView(input) ||
        input instanceof ImageData) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(deserialize);
    }

    if (typeof input === 'object') {
        const name = (input as any).$name || 'Object';
        if (!registry[name]) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }
        const {klass} = registry[name];
        if (!klass) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }

        if (klass.deserialize) {
            return klass.deserialize(input);
        }

        const result = Object.create(klass.prototype);

        for (const key of Object.keys(input)) {
            if (key === '$name') continue;
            const value = (input as SerializedObject)[key];
            result[key] = registry[name].shallow.indexOf(key) >= 0 ? value : deserialize(value);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}
