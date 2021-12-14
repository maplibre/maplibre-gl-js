import type Pbf from 'pbf';
import type Point from '../util/point';

declare module 'grid-index' {
    class TransferableGridIndex {
        constructor(extent: number, n: number, padding: number);
        constructor(arrayBuffer: ArrayBuffer);
        insert(key: number, x1: number, y1: number, x2: number, y2: number);
        query(key: number, x1: number, y1: number, x2: number, y2: number, intersectionTest?: Function): number[];
        toArrayBuffer(): ArrayBuffer;
    }
    export default TransferableGridIndex;
}

declare module '@mapbox/vector-tile' {
    import '@mapbox/vector-tile';

    interface VectorTileLayer {
        version?: number;
        name: string;
        extent: number;
        length: number;
        feature(i: number): VectorTileFeature;
    }

    class VectorTile {
        constructor(pbf: Pbf);
        layers: {[_: string]: VectorTileLayer};
    }

    class VectorTileFeature {
        static types: ['Unknown', 'Point', 'LineString', 'Polygon'];
        extent: number;
        type: 1 | 2 | 3;
        id: number;
        properties: {[_: string]: string | number | boolean};
        loadGeometry(): Array<Array<Point>>;
        toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature;
    }

    let __exports: {
        VectorTile: typeof VectorTile;
        VectorTileFeature: typeof VectorTileFeature;
    };

    export = __exports
}
