import type Point from '@mapbox/point-geometry';
import type {LngLat, LngLatLike} from '../geo/lng_lat.ts';
import type {PaddingOptions} from '../geo/edge_insets.ts';

/**
 * The callback defining how the camera constrains the viewport's lnglat and zoom to respect the longitude and latitude bounds.
 * @see [Customize the map transform constrain](https://maplibre.org/maplibre-gl-js/docs/examples/customize-the-map-transform-constrain/)
 */
export type TransformConstrainFunction =  (
    lngLat: LngLat,
    zoom: number
) => {
    center: LngLat;
    zoom: number;
};

/**
 * @internal
 * The depth range of a projection matrix, from the near to the far clipping plane.
 */
export type NearFarZ = {
    readonly nearZ: number;
    readonly farZ: number;
};

/**
 * @internal
 * The camera placement `calculateCameraOptionsFromTo` of a `CameraSolver` solves for.
 */
export type CameraOptionsFromTo = {center: LngLat; elevation: number; zoom: number; pitch: number; bearing: number};

/**
 * A [Point](https://github.com/mapbox/point-geometry) or an array of two numbers representing `x` and `y` screen coordinates in pixels.
 *
 * @group Geography and Geometry
 *
 * @example
 * ```ts
 * let p1 = new Point(-77, 38); // a PointLike which is a Point
 * let p2 = [-77, 38]; // a PointLike which is an array of two numbers
 * ```
 */
export type PointLike = Point | [number, number];

/**
 * Options common to {@link Map.jumpTo}, {@link Map.easeTo}, and {@link Map.flyTo}, controlling the desired location,
 * zoom, bearing, pitch, and roll of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @example
 * Set the map's initial perspective with CameraOptions
 * ```ts
 * let map = new Map({
 *   container: 'map',
 *   style: 'https://demotiles.maplibre.org/style.json',
 *   center: [-73.5804, 45.53483],
 *   pitch: 60,
 *   bearing: -60,
 *   zoom: 10
 * });
 * ```
 * @see [Set pitch and bearing](https://maplibre.org/maplibre-gl-js/docs/examples/set-pitch-and-bearing/)
 * @see [Jump to a series of locations](https://maplibre.org/maplibre-gl-js/docs/examples/jump-to-a-series-of-locations/)
 * @see [Fly to a location](https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location/)
 * @see [Display buildings in 3D](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/)
 */
export type CameraOptions = CenterZoomBearing & {
    /**
     * The desired pitch in degrees. The pitch is the angle towards the horizon
     * measured in degrees with a range between 0 and 60 degrees. For example, pitch: 0 provides the appearance
     * of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon.
     * Increasing the pitch value is often used to display 3D objects.
     */
    pitch?: number;
    /**
     * The desired roll in degrees. The roll is the angle about the camera boresight.
     */
    roll?: number;
    /**
     * The elevation of the center point in meters above sea level.
     */
    elevation?: number;
};

/**
 * Holds center, zoom and bearing properties
 */
export type CenterZoomBearing = {
    /**
     * The desired center.
     */
    center?: LngLatLike;
    /**
     * The desired mercator zoom level.
     */
    zoom?: number;
    /**
     * The desired bearing in degrees. The bearing is the compass direction that
     * is "up". For example, `bearing: 90` orients the map so that east is up.
     */
    bearing?: number;
};

/**
 * A options object for the {@link Map.cameraForBounds} method
 */
export type CameraForBoundsOptions = CameraOptions & {
    /**
     * The amount of padding in pixels to add to the given bounds, on top of the map's current padding.
     */
    padding?: number | PaddingOptions;
    /**
     * If `true`, `padding` replaces the map's current padding instead of adding to it, and is returned with the result.
     * This will become the default in version 7.
     * @defaultValue false
     */
    absolutePadding?: boolean;
    /**
     * The center of the given bounds relative to the map's center, measured in pixels.
     * @defaultValue [0, 0]
     */
    offset?: PointLike;
    /**
     * The maximum zoom level to allow when the camera would transition to the specified bounds.
     */
    maxZoom?: number;
};
