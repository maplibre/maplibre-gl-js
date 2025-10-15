import Point from '@mapbox/point-geometry';
import {type VectorTile, type VectorTileFeature, type VectorTileLayer} from '@mapbox/vector-tile';
import {FeatureTable, decodeTile} from '@maplibre/mlt';

type PublicPart<T> = {[K in keyof T]: T[K]};


class MLTVectorTileFeature implements PublicPart<VectorTileFeature> {
    _featureData: GeoJSON.Feature;
    properties: {[_: string]: any};
    type: VectorTileFeature['type'];
    extent: VectorTileFeature['extent'];
    id: VectorTileFeature['id'];

    constructor(feature: GeoJSON.Feature, extent: number) {
        this._featureData = feature;
        this.properties = this._featureData.properties || {};
        switch (this._featureData.geometry?.type) {
            case 'Point':
            case 'MultiPoint':
                this.type = 1;
                break;
            case 'MultiLineString':
            case 'LineString':
                this.type = 2;
                break;
            case 'Polygon':
            case 'MultiPolygon':
                this.type = 3;
                break;
            default:
                this.type = 0;
        };
        this.extent = extent;
        this.id = Number(this._featureData.id);
    }

    toGeoJSON(_x: number, _y: number, _z: number): GeoJSON.Feature {
        return this._featureData;
    }

    loadGeometry(): Point[][] {
        switch (this._featureData.geometry?.type) {
            case 'Point':
                return [[new Point((this._featureData.geometry.coordinates)[0], (this._featureData.geometry.coordinates)[1])]];
            case 'MultiPoint':
                return (this._featureData.geometry.coordinates).map(coord => [new Point(coord[0], coord[1])]);
            case 'LineString':
                return [(this._featureData.geometry.coordinates).map(coord => new Point(coord[0], coord[1]))];
            case 'MultiLineString':
                return (this._featureData.geometry.coordinates).map(line => line.map(coord => new Point(coord[0], coord[1])));
            case 'Polygon':
                return (this._featureData.geometry.coordinates).map(ring => ring.map(coord => new Point(coord[0], coord[1])));
            case 'MultiPolygon':
                return (this._featureData.geometry.coordinates).map(polygon => polygon.flatMap(ring => ring.map(coord => new Point(coord[0], coord[1]))));
            default:
                return [];
        }
    }
    bbox(): number[] {
        return [0, 0, 0, 0];
    }
}

class MLTVectorTileLayer implements PublicPart<VectorTileLayer> {
    featureTable: FeatureTable;
    name: string;
    length: number;
    version: number;
    extent: number;

    constructor(featureTable: FeatureTable) {
        this.featureTable = featureTable;
        this.name = featureTable.name;
        this.length = featureTable.numFeatures;
        this.extent = featureTable.extent;
        this.version = 2;
    }

    feature(i: number): VectorTileFeature {
        return new MLTVectorTileFeature(this.featureTable[i], this.extent) as unknown as VectorTileFeature;
    }
}

export class MLTVectorTile implements VectorTile {
    layers: Record<string, VectorTileLayer> = {};

    constructor(buffer: ArrayBuffer) {
        const features = decodeTile(new Uint8Array(buffer));
        this.layers = features.reduce((acc, f) => ({...acc, [f.name]: new MLTVectorTileLayer(f)}), {});
    }

}