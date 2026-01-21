import Point from '@mapbox/point-geometry';
import type {VectorTileLayerLike, VectorTileLike, VectorTileFeatureLike} from '@maplibre/vt-pbf';

const TYPE_UNDEFINED = 0;
const TYPE_NULL = 1;
const TYPE_BOOLEAN = 2;
const TYPE_NUMBER = 3;
const TYPE_STRING = 4;
const TYPE_ARRAY = 5;
const TYPE_OBJECT = 6;

type SerializableValue = undefined | null | boolean | number | string | SerializableValue[] | { [key: string]: SerializableValue };
/**
 * Compact Tile serializer for worker threads.
 * Optimized for maximum speed.
 */
class FastTileSerializer {
    private buffer: ArrayBuffer;
    private view: DataView;
    private pos: number;
    private textEncoder: TextEncoder;
    private encodedStrings: Map<string, Uint8Array>;

    constructor() {
        this.buffer = new ArrayBuffer(0);
        this.view = new DataView(this.buffer);
        this.pos = 0;
        this.textEncoder = new TextEncoder();
        this.encodedStrings = new Map();
    }

    private writeUint8(value: number): void {
        this.view.setUint8(this.pos++, value);
    }

    private writeUint16(value: number): void {
        this.view.setUint16(this.pos, value, true);
        this.pos += 2;
    }

    private writeUint32(value: number): void {
        this.view.setUint32(this.pos, value, true);
        this.pos += 4;
    }

    private writeFloat64(value: number): void {
        this.view.setFloat64(this.pos, value, true);
        this.pos += 8;
    }

    private getEncodedString(str: string): Uint8Array {
        let encoded = this.encodedStrings.get(str);
        if (!encoded) {
            encoded = this.textEncoder.encode(str);
            this.encodedStrings.set(str, encoded);
        }
        return encoded;
    }

    private writeString(str: string): void {
        const encoded = this.getEncodedString(str);
        this.writeUint32(encoded.length);
        new Uint8Array(this.buffer).set(encoded, this.pos);
        this.pos += encoded.length;
    }

    private writeValue(value: SerializableValue): void {
        if (value === undefined) {
            this.writeUint8(TYPE_UNDEFINED);
        } else if (value === null) {
            this.writeUint8(TYPE_NULL);
        } else if (typeof value === 'boolean') {
            this.writeUint8(TYPE_BOOLEAN);
            this.writeUint8(value ? 1 : 0);
        } else if (typeof value === 'number') {
            this.writeUint8(TYPE_NUMBER);
            this.writeFloat64(value);
        } else if (typeof value === 'string') {
            this.writeUint8(TYPE_STRING);
            this.writeString(value);
        } else if (Array.isArray(value)) {
            this.writeUint8(TYPE_ARRAY);
            this.writeUint32(value.length);
            for (let i = 0; i < value.length; i++) {
                this.writeValue(value[i]);
            }
        } else if (typeof value === 'object') {
            this.writeUint8(TYPE_OBJECT);
            const keys = Object.keys(value);
            this.writeUint32(keys.length);
            for (const key of keys) {
                this.writeString(key);
                this.writeValue(value[key]);
            }
        }
    }

    // Calculate size for a value - also caches string encodings
    private calculateValueSize(value: SerializableValue): number {
        if (value === undefined || value === null) {
            return 1;
        } else if (typeof value === 'boolean') {
            return 2;
        } else if (typeof value === 'number') {
            return 9;
        } else if (typeof value === 'string') {
            const encoded = this.getEncodedString(value);
            return 1 + 4 + encoded.length;
        } else if (Array.isArray(value)) {
            let size = 1 + 4;
            for (let i = 0; i < value.length; i++) {
                size += this.calculateValueSize(value[i]);
            }
            return size;
        } else if (typeof value === 'object') {
            let size = 1 + 4;
            const keys = Object.keys(value);
            for (const key of keys) {
                const encoded = this.getEncodedString(key);
                size += 4 + encoded.length;
                size += this.calculateValueSize(value[key]);
            }
            return size;
        }
        return 0;
    }

    private calculateGeometrySize(geometry: Point[][]): number {
        let size = 4; // ring count
        size += geometry.length * 4; // ring sizes
        
        for (let i = 0; i < geometry.length; i++) {
            size += geometry[i].length * 4;
        }
        
        return size;
    }

    private calculateFeatureSize(feature: VectorTileFeatureLike): number {
        let size = 1; // type
        size += this.calculateGeometrySize(feature.loadGeometry());
        size += this.calculateValueSize(feature.properties);
        size += 1; // hasId flag
        if (feature !== undefined) {
            size += this.calculateValueSize(feature.id);
        }
        return size;
    }

    private calculateLayerSize(layer: VectorTileLayerLike, layerName: string): number {
        let size = 0;
        const encoded = this.getEncodedString(layerName);
        size += 4 + encoded.length;
        size += 1; // version
        size += 2; // extent
        size += 4; // feature count
        for (let i = 0; i < layer.length; i++) {
            size += this.calculateFeatureSize(layer.feature(i));
        }
        
        return size;
    }

    private calculateTileSize(tile: VectorTileLike): number {
        let size = 4; // layer count
        
        const layerNames = Object.keys(tile.layers);
        for (const layerName of layerNames) {
            size += this.calculateLayerSize(tile.layers[layerName], layerName);
        }
        
        return size;
    }

    private writeGeometryFast(geometry: Point[][]): void {
        const ringCount = geometry.length;
        this.writeUint32(ringCount);
        
        for (let i = 0; i < ringCount; i++) {
            this.writeUint32(geometry[i].length);
        }
        
        for (let i = 0; i < ringCount; i++) {
            const ring = geometry[i];
            const len = ring.length;
            for (let j = 0; j < len; j++) {
                this.view.setUint16(this.pos, ring[j].x, true);
                this.view.setUint16(this.pos + 2, ring[j].y, true);
                this.pos += 4;
            }
        }
    }

    private writeFeature(feature: VectorTileFeatureLike): void {
        this.writeUint8(feature.type);
        this.writeGeometryFast(feature.loadGeometry());
        this.writeValue(feature.properties);
        
        if (feature.id !== undefined) {
            this.writeUint8(1);
            this.writeValue(feature.id);
        } else {
            this.writeUint8(0);
        }
    }

    private writeLayer(layer: VectorTileLayerLike): void {
        this.writeUint8(layer.version);
        this.writeUint16(layer.extent);
        this.writeUint32(layer.length);
        
        for (let i = 0; i < layer.length; i++) {
            this.writeFeature(layer.feature(i));
        }
    }

    serialize(tile: VectorTileLike): Uint8Array {
        this.encodedStrings.clear();
        
        const totalSize = this.calculateTileSize(tile);
        
        this.buffer = new ArrayBuffer(totalSize);
        this.view = new DataView(this.buffer);
        this.pos = 0;
        
        const layerNames = Object.keys(tile.layers);
        this.writeUint32(layerNames.length);
        
        for (const layerName of layerNames) {
            this.writeString(layerName);
            this.writeLayer(tile.layers[layerName]);
        }

        return new Uint8Array(this.buffer);
    }
}

class FastTileDeserializer {
    private view: DataView;
    private bytes: Uint8Array;
    private pos: number;
    private textDecoder: TextDecoder;

    constructor(uint8Array: Uint8Array) {
        this.view = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
        this.bytes = uint8Array;
        this.pos = 0;
        this.textDecoder = new TextDecoder();
    }

    private readUint8(): number {
        return this.view.getUint8(this.pos++);
    }

    private readUint16(): number {
        const value = this.view.getUint16(this.pos, true);
        this.pos += 2;
        return value;
    }

    private readUint32(): number {
        const value = this.view.getUint32(this.pos, true);
        this.pos += 4;
        return value;
    }

    private readFloat64(): number {
        const value = this.view.getFloat64(this.pos, true);
        this.pos += 8;
        return value;
    }

    private readString(): string {
        const length = this.readUint32();
        const value = this.textDecoder.decode(this.bytes.subarray(this.pos, this.pos + length));
        this.pos += length;
        return value;
    }

    private readValue(): SerializableValue {
        const type = this.readUint8();
        
        switch (type) {
            case TYPE_UNDEFINED:
                return undefined;
            case TYPE_NULL:
                return null;
            case TYPE_BOOLEAN:
                return this.readUint8() === 1;
            case TYPE_NUMBER:
                return this.readFloat64();
            case TYPE_STRING:
                return this.readString();
            case TYPE_ARRAY: {
                const length = this.readUint32();
                const arr: SerializableValue[] = new Array(length);
                for (let i = 0; i < length; i++) {
                    arr[i] = this.readValue();
                }
                return arr;
            }
            case TYPE_OBJECT: {
                const length = this.readUint32();
                const obj: { [key: string]: SerializableValue } = {};
                for (let i = 0; i < length; i++) {
                    const key = this.readString();
                    obj[key] = this.readValue();
                }
                return obj;
            }
            default:
                throw new Error(`Unknown type: ${type}`);
        }
    }

    private readGeometryFast(): Point[][] {
        const ringCount = this.readUint32();
        
        const ringSizes = new Array(ringCount);
        for (let i = 0; i < ringCount; i++) {
            ringSizes[i] = this.readUint32();
        }
        
        const geometry: Point[][] = new Array(ringCount);
        for (let i = 0; i < ringCount; i++) {
            const pointCount = ringSizes[i];
            const ring: Point[] = new Array(pointCount);
            
            for (let j = 0; j < pointCount; j++) {
                ring[j] = new Point(
                    this.view.getUint16(this.pos, true),
                    this.view.getUint16(this.pos + 2, true)
                );
                this.pos += 4;
            }
            
            geometry[i] = ring;
        }
        
        return geometry;
    }

    private readFeature(extent: number): VectorTileFeatureLike {
        const type = this.readUint8() as 0 | 1 | 2 | 3;
        const geometry = this.readGeometryFast();
        const properties = this.readValue() as Record<string, any>;
        
        const feature: VectorTileFeatureLike = {
            type,
            properties,
            extent,
            id: undefined,
            loadGeometry: () => {
                return geometry;
            }
        };
        
        const hasId = this.readUint8();
        if (hasId) {
            feature.id = this.readValue() as number;
        }
        
        return feature;
    }

    private readLayer(name: string): VectorTileLayerLike {
        const version = this.readUint8();
        const extent = this.readUint16();
        const featureCount = this.readUint32();
        
        const features: VectorTileFeatureLike[] = new Array(featureCount);
        for (let i = 0; i < featureCount; i++) {
            features[i] = this.readFeature(extent);
        }
        
        return {
            name,
            length: features.length,
            version,
            extent,
            feature: (i) => {
                return features[i];
            }
        };
    }

    deserialize(): VectorTileLike {
        const layerCount = this.readUint32();
        const tile: VectorTileLike = {
            layers: {}
        };
        
        for (let i = 0; i < layerCount; i++) {
            const layerName = this.readString();
            tile.layers[layerName] = this.readLayer(layerName);
        }
        
        return tile;
    }
}

export function serializeTile(tile: VectorTileLike): Uint8Array {
    const serializer = new FastTileSerializer();
    return serializer.serialize(tile);
}

export function deserializeTile(uint8Array: Uint8Array): VectorTileLike {
    const deserializer = new FastTileDeserializer(uint8Array);
    return deserializer.deserialize();
}