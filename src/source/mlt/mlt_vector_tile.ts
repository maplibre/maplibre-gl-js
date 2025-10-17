import Point from '@mapbox/point-geometry';
import {type VectorTile, type VectorTileFeature, type VectorTileLayer} from '@mapbox/vector-tile';
import {type FeatureTable, decodeTile, type Feature as MLTFeature} from '@maplibre/mlt';

type PublicPart<T> = {[K in keyof T]: T[K]};

class MLTVectorTileFeature implements PublicPart<VectorTileFeature> {
    _featureData: MLTFeature;
    properties: {[_: string]: any};
    type: VectorTileFeature['type'];
    extent: VectorTileFeature['extent'];
    id: VectorTileFeature['id'];

    constructor(feature: MLTFeature, extent: number) {
        this._featureData = feature;
        this.properties = this._featureData.properties || {};
        switch (this._featureData.geometry?.type) {
            case 0: // POINT
            case 3: // MULTI_POINT
                this.type = 1;
                break;
            case 1: // LINESTRING
            case 4: // MULTI_LINESTRING
                this.type = 2;
                break;
            case 2: // POLYGON
            case 5: // MULTI_POLYGON
                this.type = 3;
                break;
            default:
                this.type = 0;
        };
        this.extent = extent;
        this.id = Number(this._featureData.id);
    }

    toGeoJSON(_x: number, _y: number, _z: number): GeoJSON.Feature {
        throw new Error('MLTVectorTileFeature.toGeoJSON not implemented');
    }

    loadGeometry(): Point[][] {
        return this._featureData.geometry.coordinates;
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
    features: MLTFeature[] = [];

    constructor(featureTable: FeatureTable) {
        this.featureTable = featureTable;
        this.name = featureTable.name;
        this.extent = featureTable.extent;
        this.version = 2;
        let index = 0;
        for (const feature of featureTable) {
            if (feature.geometry != null && feature.geometry.type !== undefined) {
                this.features.push(feature);
            } else {
                console.log(`Skipping feature with no geometry in layer ${this.name}`, feature, index);
            }
            index++;
        }
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