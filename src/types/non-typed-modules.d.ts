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

declare module '@mapbox/unitbezier' {
    class UnitBezier {
        constructor(p1x: number, p1y: number, p2x: number, p2y: number);
        sampleCurveX(t: number): number;
        sampleCurveY(t: number): number;
        sampleCurveDerivativeX(t: number): number;
        solveCurveX(x: number, epsilon: number | void): number;
        solve(x: number, epsilon: number | void): number;
    }

    let __exports: typeof UnitBezier;
    export = __exports
}
declare module 'potpack' {
    type Bin = {
        x: number;
        y: number;
        w: number;
        h: number;
    };

    function potpack(bins: Array<Bin>): {
        w: number;
        h: number;
        fill: number;
    }

    let __exports: typeof potpack;
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
