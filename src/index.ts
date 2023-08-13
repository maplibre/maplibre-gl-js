import packageJSON from '../package.json' assert {type: 'json'};
import {Map} from './ui/map';
import {NavigationControl} from './ui/control/navigation_control';
import {GeolocateControl} from './ui/control/geolocate_control';
import {AttributionControl} from './ui/control/attribution_control';
import {LogoControl} from './ui/control/logo_control';
import {ScaleControl} from './ui/control/scale_control';
import {FullscreenControl} from './ui/control/fullscreen_control';
import {TerrainControl} from './ui/control/terrain_control';
import {Popup} from './ui/popup';
import {Marker} from './ui/marker';
import {Style} from './style/style';
import {LngLat} from './geo/lng_lat';
import {LngLatBounds} from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from './geo/mercator_coordinate';
import {Evented} from './util/evented';
import {config} from './util/config';
import {Debug} from './util/debug';
import {isSafari} from './util/util';
import {setRTLTextPlugin, getRTLTextPluginStatus} from './source/rtl_text_plugin';
import {WorkerPool} from './util/worker_pool';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool';
import {PerformanceUtils} from './util/performance';
import {AJAXError} from './util/ajax';
import type {RequestParameters, ResponseCallback} from './util/ajax';
import type {Cancelable} from './types/cancelable';
import {GeoJSONSource} from './source/geojson_source';
import {CanvasSource} from './source/canvas_source';
import {ImageSource} from './source/image_source';
import {RasterDEMTileSource} from './source/raster_dem_tile_source';
import {RasterTileSource} from './source/raster_tile_source';
import {VectorTileSource} from './source/vector_tile_source';
import {VideoSource} from './source/video_source';

const version = packageJSON.version;

export type * from '@maplibre/maplibre-gl-style-spec';

/**
 * `maplibregl` is the global object that allows configurations that are not specific to a map instance
 *
 * @group Main
 */
class MapLibreGL {
    static Map = Map;
    static NavigationControl = NavigationControl;
    static GeolocateControl = GeolocateControl;
    static AttributionControl = AttributionControl;
    static LogoControl = LogoControl;
    static ScaleControl = ScaleControl;
    static FullscreenControl = FullscreenControl;
    static TerrainControl = TerrainControl;
    static Popup = Popup;
    static Marker = Marker;
    static Style = Style;
    static LngLat = LngLat;
    static LngLatBounds = LngLatBounds;
    static Point = Point;
    static MercatorCoordinate = MercatorCoordinate;
    static Evented = Evented;
    static AJAXError = AJAXError;
    static config = config;
    static CanvasSource = CanvasSource;
    static GeoJSONSource = GeoJSONSource;
    static ImageSource = ImageSource;
    static RasterDEMTileSource = RasterDEMTileSource;
    static RasterTileSource = RasterTileSource;
    static VectorTileSource = VectorTileSource;
    static VideoSource = VideoSource;
    /**
     * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
     * Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left.
     *
     * @param pluginURL - URL pointing to the Mapbox RTL text plugin source.
     * @param callback - Called with an error argument if there is an error.
     * @param lazy - If set to `true`, mapboxgl will defer loading the plugin until rtl text is encountered,
     * rtl text will then be rendered only after the plugin finishes loading.
     * @example
     * ```ts
     * maplibregl.setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js');
     * ```
     * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
     */
    static setRTLTextPlugin = setRTLTextPlugin;
    /**
     * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
     * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
     * If the status is `loaded` and the plugin is requested again, an error will be thrown.
     *
     * @example
     * ```ts
     * const pluginStatus = maplibregl.getRTLTextPluginStatus();
     * ```
     */
    static getRTLTextPluginStatus = getRTLTextPluginStatus;
    /**
     * Initializes resources like WebWorkers that can be shared across maps to lower load
     * times in some situations. `maplibregl.workerUrl` and `maplibregl.workerCount`, if being
     * used, must be set before `prewarm()` is called to have an effect.
     *
     * By default, the lifecycle of these resources is managed automatically, and they are
     * lazily initialized when a Map is first created. By invoking `prewarm()`, these
     * resources will be created ahead of time, and will not be cleared when the last Map
     * is removed from the page. This allows them to be re-used by new Map instances that
     * are created later. They can be manually cleared by calling
     * `maplibregl.clearPrewarmedResources()`. This is only necessary if your web page remains
     * active but stops using maps altogether.
     *
     * This is primarily useful when using GL-JS maps in a single page app, wherein a user
     * would navigate between various views that can cause Map instances to constantly be
     * created and destroyed.
     *
     * @example
     * ```ts
     * maplibregl.prewarm()
     * ```
     */
    static prewarm = prewarm;
    /**
     * Clears up resources that have previously been created by `maplibregl.prewarm()`.
     * Note that this is typically not necessary. You should only call this function
     * if you expect the user of your app to not return to a Map view at any point
     * in your application.
     *
     * @example
     * ```ts
     * maplibregl.clearPrewarmedResources()
     * ```
     */
    static clearPrewarmedResources = clearPrewarmedResources;
    /**
     * Returns the package version of the library
     * @returns Package version of the library
     */
    static get version(): string {
        return version;
    }

    /**
     * Gets and sets the number of web workers instantiated on a page with GL JS maps.
     * By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3).
     * Make sure to set this property before creating any map instances for it to have effect.
     *
     * @returns Number of workers currently configured.
     * @example
     * ```ts
     * maplibregl.workerCount = 2;
     * ```
     */
    static get workerCount(): number {
        return WorkerPool.workerCount;
    }

    static set workerCount(count: number) {
        WorkerPool.workerCount = count;
    }
    /**
     * Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
     * which affects performance in raster-heavy maps. 16 by default.
     *
     * @returns Number of parallel requests currently configured.
     * @example
     * ```ts
     * maplibregl.maxParallelImageRequests = 10;
     * ```
     */
    static get maxParallelImageRequests(): number {
        return config.MAX_PARALLEL_IMAGE_REQUESTS;
    }

    static set maxParallelImageRequests(numRequests: number) {
        config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests;
    }

    static get workerUrl(): string {
        return config.WORKER_URL;
    }

    static set workerUrl(value: string) {
        config.WORKER_URL = value;
    }

    /**
     * Sets a custom load tile function that will be called when using a source that starts with a custom url schema.
     * The example below will be triggered for custom:// urls defined in the sources list in the style definitions.
     * The function passed will receive the request parameters and should call the callback with the resulting request,
     * for example a pbf vector tile, non-compressed, represented as ArrayBuffer.
     *
     * @param customProtocol - the protocol to hook, for example 'custom'
     * @param loadFn - the function to use when trying to fetch a tile specified by the customProtocol
     * @example
     * This will fetch a file using the fetch API (this is obviously a non interesting example...)
     * ```ts
     * maplibregl.addProtocol('custom', (params, callback) => {
            fetch(`https://${params.url.split("://")[1]}`)
                .then(t => {
                    if (t.status == 200) {
                        t.arrayBuffer().then(arr => {
                            callback(null, arr, null, null);
                        });
                    } else {
                        callback(new Error(`Tile fetch error: ${t.statusText}`));
                    }
                })
                .catch(e => {
                    callback(new Error(e));
                });
            return { cancel: () => { } };
        });
     * // the following is an example of a way to return an error when trying to load a tile
     * maplibregl.addProtocol('custom2', (params, callback) => {
     *      callback(new Error('someErrorMessage'));
     *      return { cancel: () => { } };
     * });
     * ```
     */
    static addProtocol(customProtocol: string, loadFn: (requestParameters: RequestParameters, callback: ResponseCallback<any>) => Cancelable) {
        config.REGISTERED_PROTOCOLS[customProtocol] = loadFn;
    }

    /**
     * Removes a previously added protocol
     *
     * @param customProtocol - the custom protocol to remove registration for
     * @example
     * ```ts
     * maplibregl.removeProtocol('custom');
     * ```
     */
    static removeProtocol(customProtocol: string) {
        delete config.REGISTERED_PROTOCOLS[customProtocol];
    }
}

//This gets automatically stripped out in production builds.
Debug.extend(MapLibreGL, {isSafari, getPerformanceMetrics: PerformanceUtils.getPerformanceMetrics});

export default MapLibreGL;
