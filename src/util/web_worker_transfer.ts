import {TransferableGridIndex} from './transferable_grid_index';
import {Color, CompoundExpression, expressions, ResolvedImage, StylePropertyFunction,
    StyleExpression, ZoomDependentExpression, ZoomConstantExpression} from '@maplibre/maplibre-gl-style-spec';
import {AJAXError} from './ajax';
import {isImageBitmap} from './util';

/**
 * A class that is serialized to and json, that can be constructed back to the original class in the worker or in the main thread
 */
type SerializedObject<S extends Serialized = any> = {
    [_: string]: S;
};

/**
 * All the possible values that can be serialized and sent to and from the worker
 */
export type Serialized = null | void | boolean | number | string | Boolean | Number | String | Date | RegExp | ArrayBuffer | ArrayBufferView | ImageData | ImageBitmap | Blob | Array<Serialized> | SerializedObject;

type Registry = {
    [_: string]: {
        klass: {
            new (...args: any): any;
            deserialize?: (input: Serialized) => unknown;
            serialize?: (input: any, transferables: Transferable[]) => SerializedObject;
        };
        omit: ReadonlyArray<string>;
        shallow: ReadonlyArray<string>;
    };
};

/**
 * Register options
 */
type RegisterOptions<T> = {
    /**
     * List of properties to omit from serialization (e.g., cached/computed properties)
     */
    omit?: ReadonlyArray<keyof T>;
    /**
     * List of properties that should be serialized by a simple shallow copy, rather than by a recursive call to serialize().
     */
    shallow?: ReadonlyArray<keyof T>;
};

const registry: Registry = {};

/**
 * Register the given class as serializable.
 *
 * @param options - the registration options
 */
export function register<T extends any>(
    name: string,
    klass: {
        new (...args: any): T;
    },
    options: RegisterOptions<T> = {}
) {
    if (registry[name]) throw new Error(`${name} is already registered.`);
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

function getClassRegistryKey(input: Object|SerializedObject): string {
    const klass = (input.constructor as any);
    return (input as SerializedObject).$name || klass._classRegistryKey;
}

function isRegistered(input: unknown): boolean {
    if (input === null || typeof input !== 'object') {
        return false;
    }
    const classRegistryKey = getClassRegistryKey(input);
    if (classRegistryKey && classRegistryKey !== 'Object') {
        return true;
    }
    return false;
}

function isSerializeHandledByBuiltin(input: unknown) {
    return (!isRegistered(input) && (
        input === null ||
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
        input instanceof Error ||
        isArrayBuffer(input) ||
        isImageBitmap(input) ||
        ArrayBuffer.isView(input) ||
        input instanceof ImageData)
    );
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
 */
export function serialize(input: unknown, transferables?: Array<Transferable> | null): Serialized {
    if (isSerializeHandledByBuiltin(input)) {
        if (isArrayBuffer(input) || isImageBitmap(input)) {
            if (transferables) {
                transferables.push(input);
            }
        }
        if (ArrayBuffer.isView(input)) {
            const view = input;
            if (transferables) {
                transferables.push(view.buffer);
            }
        }
        if (input instanceof ImageData) {
            if (transferables) {
                transferables.push(input.data.buffer);
            }
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

    if (typeof input !== 'object') {
        throw new Error(`can't serialize object of type ${typeof input}`);
    }
    const classRegistryKey = getClassRegistryKey(input);
    if (!classRegistryKey) {
        throw new Error(`can't serialize object of unregistered class ${input.constructor.name}`);
    }
    if (!registry[classRegistryKey]) throw new Error(`${classRegistryKey} is not registered.`);
    const {klass} = registry[classRegistryKey];
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
            if (!input.hasOwnProperty(key)) continue;
            if (registry[classRegistryKey].omit.indexOf(key) >= 0) continue;
            const property = input[key];
            properties[key] = registry[classRegistryKey].shallow.indexOf(key) >= 0 ?
                property :
                serialize(property, transferables);
        }
        if (input instanceof Error) {
            properties.message = input.message;
        }
    } else {
        if (transferables && properties === transferables[transferables.length - 1]) {
            throw new Error('statically serialized object won\'t survive transfer of $name property');
        }
    }

    if (properties.$name) {
        throw new Error('$name property is reserved for worker serialization logic.');
    }
    if (classRegistryKey !== 'Object') {
        properties.$name = classRegistryKey;
    }

    return properties;
}

export function deserialize(input: Serialized): unknown {
    if (isSerializeHandledByBuiltin(input)) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(deserialize);
    }

    if (typeof input !== 'object') {
        throw new Error(`can't deserialize object of type ${typeof input}`);
    }
    const classRegistryKey = getClassRegistryKey(input) || 'Object';
    if (!registry[classRegistryKey]) {
        throw new Error(`can't deserialize unregistered class ${classRegistryKey}`);
    }
    const {klass} = registry[classRegistryKey];
    if (!klass) {
        throw new Error(`can't deserialize unregistered class ${classRegistryKey}`);
    }

    if (klass.deserialize) {
        return klass.deserialize(input);
    }

    const result = Object.create(klass.prototype);

    for (const key of Object.keys(input)) {
        if (key === '$name') continue;
        const value = (input as SerializedObject)[key];
        result[key] = registry[classRegistryKey].shallow.indexOf(key) >= 0 ? value : deserialize(value);
    }

    return result;
}
