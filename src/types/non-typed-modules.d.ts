import type Pbf from 'pbf';

declare module '@mapbox/mapbox-gl-supported' {
    type isSupported = {
        webGLContextAttributes: WebGLContextAttributes;
        (
            options?: {
                failIfMajorPerformanceCaveat: boolean;
            }
        ): boolean;
    };

    let __exports: {
        supported: isSupported;
    };
    export = __exports
}

declare global {
    declare interface VectorTile {
        layers: {[_: string]: VectorTileLayer};
    }

    declare interface VectorTileLayer {
        version?: number;
        name: string;
        extent: number;
        length: number;
        feature(i: number): VectorTileFeature;
    }

    declare interface VectorTileFeature {
        extent: number;
        type: 1 | 2 | 3;
        id: number;
        properties: {[_: string]: string | number | boolean};
        loadGeometry(): Array<Array<Point>>;
        toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature;
    }
}

declare module '@mapbox/vector-tile' {
    import '@mapbox/vector-tile';
    class VectorTileImpl {
        constructor(pbf: Pbf);
    }

    class VectorTileFeatureImpl {
        static types: ['Unknown', 'Point', 'LineString', 'Polygon'];
        toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature;
    }

    let __exports: {
        VectorTile: typeof VectorTileImpl;
        VectorTileFeature: typeof VectorTileFeatureImpl;
    };

    export = __exports
}
