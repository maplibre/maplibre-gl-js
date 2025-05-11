import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

/**
 * A helper for type to omit a property from a type
 */
type DistributiveKeys<T> = T extends T ? keyof T : never;
/**
 * A helper for type to omit a property from a type
 */
type DistributiveOmit<T, K extends DistributiveKeys<T>> = T extends unknown
    ? Omit<T, K>
    : never;

/**
 * An extended geojson feature used by the events to return data to the listener
 */
export type MapGeoJSONFeature = GeoJSONFeature & {
    layer: DistributiveOmit<LayerSpecification, 'source'> & {source: string};
    source: string;
    sourceLayer?: string;
    state: { [key: string]: any };
};

/**
 * A geojson feature
 */
export class GeoJSONFeature {
    type: 'Feature';
    _geometry: GeoJSON.Geometry;
    properties: { [name: string]: any };
    id: number | string | undefined;
    foreignMembers: { [name: string]: any };

    _vectorTileFeature: VectorTileFeature;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id: string | number | undefined) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        (vectorTileFeature as any)._z = z;
        (vectorTileFeature as any)._x = x;
        (vectorTileFeature as any)._y = y;

        this.properties = vectorTileFeature.properties;
        this.id = id;
        this.foreignMembers = {};

        for (const key in vectorTileFeature) {
            if (key !== 'type' && key !== 'properties' && key !== 'id' &&
                key !== '_z' && key !== '_x' && key !== '_y' &&
                key !== 'extent' && key !== 'loadGeometry' && key !== 'toGeoJSON') {
                this.foreignMembers[key] = (vectorTileFeature as any)[key];
            }
        }
    }

    get geometry(): GeoJSON.Geometry {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(
                (this._vectorTileFeature as any)._x,
                (this._vectorTileFeature as any)._y,
                (this._vectorTileFeature as any)._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: GeoJSON.Geometry) {
        this._geometry = g;
    }

    toJSON() {
        const json: any = {
            geometry: this.geometry
        };
        for (const i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature') continue;
            json[i] = (this)[i];
        }

        for (const key in this.foreignMembers) {
            json[key] = this.foreignMembers[key];
        }

        return json;
    }
}
