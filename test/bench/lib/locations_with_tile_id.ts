import {MercatorCoordinate} from '../../../src/geo/mercator_coordinate';
import {OverscaledTileID} from '../../../src/source/tile_id';

export type LocationsWithTileID = {
    description: string;
    tileID: OverscaledTileID[];
    zoom: number;
    center: GeoJSON.Position;
}

function createLocation(position: GeoJSON.Position, zoom: number, description: any): LocationsWithTileID {
    const {x, y} = MercatorCoordinate.fromLngLat({
        lng: position[0],
        lat: position[1]
    });

    const scale = Math.pow(2, zoom);
    const tileX = Math.floor(x * scale);
    const tileY = Math.floor(y * scale);

    return {
        description,
        tileID: [new OverscaledTileID(zoom, 0, zoom, tileX, tileY)],
        zoom,
        center: position
    };
}

function createPointLocation(feature: GeoJSON.Feature<GeoJSON.Point>): LocationsWithTileID {
    const {coordinates: position} = feature.geometry;
    const {zoom} = feature.properties;
    return createLocation(position, zoom, feature.properties['place_name']);
}

function createMultiPolygonLocation(feature: GeoJSON.Feature<GeoJSON.MultiPolygon>): LocationsWithTileID {
    const {coordinates} = feature.geometry;
    const {zoom} = feature.properties;
    const position = coordinates[0][0][0];
    return createLocation(position, zoom, feature.properties['place_name']);
}

export default function locationsWithTileID(locations: GeoJSON.Feature<GeoJSON.Point | GeoJSON.MultiPolygon>[]): LocationsWithTileID[] {
    return locations.map(feature => {
        if (feature.geometry.type === 'Point') {
            return createPointLocation(feature as GeoJSON.Feature<GeoJSON.Point>);
        }
        if (feature.geometry.type === 'MultiPolygon') {
            return createMultiPolygonLocation(feature as GeoJSON.Feature<GeoJSON.MultiPolygon>);
        }
    });
}
