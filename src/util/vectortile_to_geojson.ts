import type {GeoJSONGeometry} from '@mapbox/geojson-types';

class Feature {
    type: "Feature";
    _geometry: GeoJSONGeometry | undefined | null;
    properties: {};
    id: number | string | void;

    _vectorTileFeature: VectorTileFeature;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id: string | number | void) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        (vectorTileFeature as any)._z = z;
        (vectorTileFeature as any)._x = x;
        (vectorTileFeature as any)._y = y;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    get geometry(): GeoJSONGeometry | undefined | null {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(
                (this._vectorTileFeature as any)._x,
                (this._vectorTileFeature as any)._y,
                (this._vectorTileFeature as any)._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: GeoJSONGeometry | undefined | null) {
        this._geometry = g;
    }

    toJSON() {
        const json = {
            geometry: this.geometry
        };
        for (const i in this) {
            if (i === '_geometry' || i === '_vectorTileFeature') continue;
            json[i] = (this as any)[i];
        }
        return json;
    }
}

export default Feature;
