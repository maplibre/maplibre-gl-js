import Point from '@mapbox/point-geometry';
import {type VectorTile, type VectorTileFeature, type VectorTileLayer} from '@mapbox/vector-tile';
import {type FeatureTable, decodeTile, type Feature as MLTFeature, GEOMETRY_TYPE} from '@maplibre/mlt';
import type {VectorTileFeatureLike, VectorTileLayerLike} from '@maplibre/vt-pbf';

class MLTVectorTileFeature implements VectorTileFeatureLike {
    _featureData: MLTFeature;
    properties: {[_: string]: any};
    type: VectorTileFeature['type'];
    extent: VectorTileFeature['extent'];
    id: VectorTileFeature['id'];

    constructor(feature: MLTFeature, extent: number) {
        this._featureData = feature;
        this.properties = this._featureData.properties || {};
        switch (this._featureData.geometry?.type) {
            case GEOMETRY_TYPE.POINT:
            case GEOMETRY_TYPE.MULTIPOINT:
                this.type = 1;
                break;
            case GEOMETRY_TYPE.LINESTRING:
            case GEOMETRY_TYPE.MULTILINESTRING:
                this.type = 2;
                break;
            case GEOMETRY_TYPE.POLYGON:
            case GEOMETRY_TYPE.MULTIPOLYGON:
                this.type = 3;
                break;
            default:
                this.type = 0;
        };
        this.extent = extent;
        this.id = Number(this._featureData.id);
    }

    private projectPoint(p: Point, x0: number, y0: number, size: number): [number, number] {
        return [
            (p.x + x0) * 360 / size - 180,
            360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
        ];
    }

    loadGeometry(): Point[][] {
        const points: Point[][] = [];
        for (const ring of this._featureData.geometry.coordinates) {
            const pointRing: Point[] = [];
            for (const coord of ring) {
                pointRing.push(new Point(coord.x, coord.y));
            }
            points.push(pointRing);
        }
        return points;
    }
    bbox(): number[] {
        return [0, 0, 0, 0];
    }
}

class MLTVectorTileLayer implements VectorTileLayerLike {
    featureTable: FeatureTable;
    name: string;
    length: number;
    version: number;
    extent: number;
    features: MLTFeature[] = [];

    constructor(featureTable: FeatureTable) {
        this.featureTable = featureTable;
        this.name = featureTable.name;
        this.extent = featureTable.extent;
        this.version = 2;
        this.features = featureTable.getFeatures();
        this.length = this.features.length;
    }

    feature(i: number): VectorTileFeature {
        return new MLTVectorTileFeature(this.features[i], this.extent) as unknown as VectorTileFeature;
    }
}

export class MLTVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    constructor(buffer: ArrayBuffer) {
        const features = decodeTile(new Uint8Array(buffer));
        this.layers = features.reduce((acc, f) => ({...acc, [f.name]: new MLTVectorTileLayer(f)}), {});
    }
}
