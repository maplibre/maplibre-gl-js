import packageJSON from '../package.json' with {type: 'json'};
import {Map, type MapOptions, type WebGLContextAttributesWithType} from './ui/map';
import {NavigationControl, type NavigationControlOptions} from './ui/control/navigation_control';
import {GeolocateControl, type GeolocateControlOptions} from './ui/control/geolocate_control';
import {AttributionControl, type AttributionControlOptions} from './ui/control/attribution_control';
import {LogoControl, type LogoControlOptions} from './ui/control/logo_control';
import {ScaleControl, type ScaleControlOptions, type Unit} from './ui/control/scale_control';
import {FullscreenControl, type FullscreenControlOptions} from './ui/control/fullscreen_control';
import {TerrainControl} from './ui/control/terrain_control';
import {GlobeControl} from './ui/control/globe_control';
import {type Offset, Popup, type PopupOptions} from './ui/popup';
import {type Alignment, Marker, type MarkerOptions} from './ui/marker';
import {type AddLayerObject, type FeatureIdentifier, Style, type StyleOptions, type StyleSetterOptions, type StyleSwapOptions, type TransformStyleFunction} from './style/style';
import {LngLat, type LngLatLike} from './geo/lng_lat';
import {LngLatBounds, type LngLatBoundsLike} from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from './geo/mercator_coordinate';
import {Evented, type ErrorEvent, Event, type Listener} from './util/evented';
import {type AddProtocolAction, config} from './util/config';
import {rtlMainThreadPluginFactory} from './source/rtl_text_plugin_main_thread';
import {WorkerPool} from './util/worker_pool';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool';
import {AJAXError, type ExpiryData, type GetResourceResponse, type RequestParameters} from './util/ajax';
import {GeoJSONSource, type SetClusterOptions} from './source/geojson_source';
import {CanvasSource, type CanvasSourceSpecification} from './source/canvas_source';
import {type CanonicalTileRange, type Coordinates, ImageSource, type UpdateImageOptions} from './source/image_source';
import {RasterDEMTileSource} from './source/raster_dem_tile_source';
import {RasterTileSource} from './source/raster_tile_source';
import {VectorTileSource} from './source/vector_tile_source';
import {VideoSource} from './source/video_source';
import {type Source, type SourceClass, addSourceType} from './source/source';
import {addProtocol, removeProtocol} from './source/protocol_crud';
import {type Dispatcher, getGlobalDispatcher} from './util/dispatcher';
import {EdgeInsets, type PaddingOptions} from './geo/edge_insets';
import {type MapTerrainEvent, type MapStyleImageMissingEvent, type MapStyleDataEvent, type MapSourceDataEvent, type MapLibreZoomEvent, type MapLibreEvent, type MapLayerTouchEvent, type MapLayerMouseEvent, type MapLayerEventType, type MapEventType, type MapDataEvent, type MapContextEvent, MapWheelEvent, MapTouchEvent, MapMouseEvent, type MapSourceDataType, type MapProjectionEvent} from './ui/events';
import {BoxZoomHandler} from './ui/handler/box_zoom';
import {DragRotateHandler} from './ui/handler/shim/drag_rotate';
import {DragPanHandler, type DragPanOptions} from './ui/handler/shim/drag_pan';
import {ScrollZoomHandler} from './ui/handler/scroll_zoom';
import {TwoFingersTouchZoomRotateHandler} from './ui/handler/shim/two_fingers_touch';
import {Hash} from './ui/hash';
import {CooperativeGesturesHandler, type GestureOptions} from './ui/handler/cooperative_gestures';
import {DoubleClickZoomHandler} from './ui/handler/shim/dblclick_zoom';
import {KeyboardHandler} from './ui/handler/keyboard';
import {TwoFingersTouchPitchHandler, TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler, type AroundCenterOptions} from './ui/handler/two_fingers_touch';
import {MessageType, type ActorMessage, type RequestResponseMessageMap} from './util/actor_messages';
import {createTileMesh, type CreateTileMeshOptions, type IndicesType, type TileMesh} from './util/create_tile_mesh';
import type {ControlPosition, IControl} from './ui/control/control';
import type {CustomRenderMethod, CustomLayerInterface, CustomRenderMethodInput} from './style/style_layer/custom_style_layer';
import type {AnimationOptions, CameraForBoundsOptions, CameraOptions, CameraUpdateTransformFunction, CenterZoomBearing, EaseToOptions, FitBoundsOptions, FlyToOptions, JumpToOptions, PointLike} from './ui/camera';
import type {DistributiveKeys, DistributiveOmit, GeoJSONFeature, MapGeoJSONFeature} from './util/vectortile_to_geojson';
import type {Handler, HandlerResult} from './ui/handler_manager';
import type {Complete, RequireAtLeastOne, Subscription} from './util/util';
import type {CalculateTileZoomFunction, CoveringTilesOptions} from './geo/projection/covering_tiles';
import type {StyleImage, StyleImageData, StyleImageInterface, StyleImageMetadata, TextFit} from './style/style_image';
import type {StyleLayer} from './style/style_layer';
import type {Tile} from './source/tile';
import type {GeoJSONFeatureDiff, GeoJSONFeatureId, GeoJSONSourceDiff} from './source/geojson_source_diff';
import type {QueryRenderedFeaturesOptions, QuerySourceFeatureOptions} from './source/query_features';
import type {RequestTransformFunction, ResourceType} from './util/request_manager';
import type {OverscaledTileID} from './source/tile_id';
import type {PositionAnchor} from './ui/anchor';
import type {ProjectionData} from './geo/projection/projection_data';
import type {WorkerTileResult} from './source/worker_source';
import type {Actor, IActor} from './util/actor';
import type {Bucket} from './data/bucket';
import type {CollisionBoxArray} from './data/array_types.g';
import type {AlphaImage} from './util/image';
import type {GlyphPosition, GlyphPositions} from './render/glyph_atlas';
import type {ImageAtlas} from './render/image_atlas';
import type {StyleGlyph} from './style/style_glyph';
import type {FeatureIndex} from './data/feature_index';
const version = packageJSON.version;

export type * from '@maplibre/maplibre-gl-style-spec';

/**
 * Sets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text).
 * Necessary for supporting the Arabic and Hebrew languages, which are written right-to-left.
 *
 * @param pluginURL - URL pointing to the Mapbox RTL text plugin source.
 * @param lazy - If set to `true`, maplibre will defer loading the plugin until rtl text is encountered,
 * rtl text will then be rendered only after the plugin finishes loading.
 * @example
 * ```ts
 * setRTLTextPlugin('https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js', false);
 * ```
 * @see [Add support for right-to-left scripts](https://maplibre.org/maplibre-gl-js/docs/examples/mapbox-gl-rtl-text/)
 */
function setRTLTextPlugin(pluginURL: string, lazy: boolean): Promise<void> {
    return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy);
}
/**
 * Gets the map's [RTL text plugin](https://www.mapbox.com/mapbox-gl-js/plugins/#mapbox-gl-rtl-text) status.
 * The status can be `unavailable` (i.e. not requested or removed), `loading`, `loaded` or `error`.
 * If the status is `loaded` and the plugin is requested again, an error will be thrown.
 *
 * @example
 * ```ts
 * const pluginStatus = getRTLTextPluginStatus();
 * ```
 */
function getRTLTextPluginStatus(): string {
    return rtlMainThreadPluginFactory().getRTLTextPluginStatus();
}
/**
 * Returns the package version of the library
 * @returns Package version of the library
 */
function getVersion() { return version; }
/**
 * Gets the number of web workers instantiated on a page with GL JS maps.
 * By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3).
 * Make sure to set this property before creating any map instances for it to have effect.
 *
 * @returns Number of workers currently configured.
 * @example
 * ```ts
 * const workerCount = getWorkerCount()
 * ```
 */
function getWorkerCount() { return WorkerPool.workerCount; }
/**
 * Sets the number of web workers instantiated on a page with GL JS maps.
 * By default, workerCount is 1 except for Safari browser where it is set to half the number of CPU cores (capped at 3).
 * Make sure to set this property before creating any map instances for it to have effect.
 *
 * @example
 * ```ts
 * setWorkerCount(2);
 * ```
 */
function setWorkerCount(count: number) { WorkerPool.workerCount = count; }
/**
 * Gets and sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
 * which affects performance in raster-heavy maps. 16 by default.
 *
 * @returns Number of parallel requests currently configured.
 * @example
 * ```ts
 * getMaxParallelImageRequests();
 * ```
 */
function getMaxParallelImageRequests() { return config.MAX_PARALLEL_IMAGE_REQUESTS; }
/**
 * Sets the maximum number of images (raster tiles, sprites, icons) to load in parallel,
 * which affects performance in raster-heavy maps. 16 by default.
 *
 * @example
 * ```ts
 * setMaxParallelImageRequests(10);
 * ```
 */
function setMaxParallelImageRequests(numRequests: number) { config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests; }
/**
 * Gets the worker url
 * @returns The worker url
 */
function getWorkerUrl() { return config.WORKER_URL; }
/**
 * Sets the worker url
 */
function setWorkerUrl(value: string) { config.WORKER_URL = value; }
/**
 * Allows loading javascript code in the worker thread.
 * *Note* that since this is using some very internal classes and flows it is considered experimental and can break at any point.
 *
 * It can be useful for the following examples:
 * 1. Using `self.addProtocol` in the worker thread - note that you might need to also register the protocol on the main thread.
 * 2. Using `self.registerWorkerSource(workerSource: WorkerSource)` to register a worker source, which should come with `addSourceType` usually.
 * 3. using `self.actor.registerMessageHandler` to override some internal worker operations
 * @param workerUrl - the worker url e.g. a url of a javascript file to load in the worker
 * @returns
 *
 * @example
 * ```ts
 * // below is an example of sending a js file to the worker to load the method there
 * // Note that you'll need to call the global function `addProtocol` in the worker to register the protocol there.
 * // add-protocol-worker.js
 * async function loadFn(params, abortController) {
 *     const t = await fetch(`https://${params.url.split("://")[1]}`);
 *     if (t.status == 200) {
 *         const buffer = await t.arrayBuffer();
 *         return {data: buffer}
 *     } else {
 *         throw new Error(`Tile fetch error: ${t.statusText}`);
 *     }
 * }
 * self.addProtocol('custom', loadFn);
 *
 * // main.js
 * importScriptInWorkers('add-protocol-worker.js');
 * ```
 */
function importScriptInWorkers(workerUrl: string) { return getGlobalDispatcher().broadcast(MessageType.importScript, workerUrl); }

export {
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    LogoControl,
    ScaleControl,
    FullscreenControl,
    TerrainControl,
    GlobeControl,
    Hash,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
    Evented,
    Event,
    AJAXError,
    config,
    CanvasSource,
    GeoJSONSource,
    ImageSource,
    RasterDEMTileSource,
    RasterTileSource,
    VectorTileSource,
    VideoSource,
    EdgeInsets,
    BoxZoomHandler,
    DragRotateHandler,
    DragPanHandler,
    ScrollZoomHandler,
    TwoFingersTouchZoomRotateHandler,
    CooperativeGesturesHandler,
    DoubleClickZoomHandler,
    KeyboardHandler,
    TwoFingersTouchZoomHandler,
    TwoFingersTouchRotateHandler,
    TwoFingersTouchPitchHandler,
    MapWheelEvent,
    MapTouchEvent,
    MapMouseEvent,
    type Handler,
    type RequireAtLeastOne,
    type CameraUpdateTransformFunction,
    type CustomRenderMethod,
    type CalculateTileZoomFunction,
    type MapSourceDataType,
    type TileMesh,
    type CreateTileMeshOptions,
    type ControlPosition,
    type Subscription,
    type Complete,
    type CameraOptions,
    type CenterZoomBearing,
    type StyleImage,
    type StyleImageData,
    type StyleImageMetadata,
    type StyleLayer,
    type GetResourceResponse,
    type MapGeoJSONFeature,
    type Alignment,
    type AddProtocolAction,
    type SourceClass,
    type IndicesType,
    type AttributionControlOptions,
    type CanonicalTileRange,
    type Tile,
    type Listener,
    type Coordinates,
    type UpdateImageOptions,
    type DragPanOptions,
    type FullscreenControlOptions,
    type SetClusterOptions,
    type GeoJSONSourceDiff,
    type GeolocateControlOptions,
    type LogoControlOptions,
    type StyleImageInterface,
    type AddLayerObject,
    type StyleSetterOptions,
    type CameraForBoundsOptions,
    type EaseToOptions,
    type FitBoundsOptions,
    type FlyToOptions,
    type FeatureIdentifier,
    type JumpToOptions,
    type QueryRenderedFeaturesOptions,
    type QuerySourceFeatureOptions,
    type AnimationOptions,
    type StyleSwapOptions,
    type StyleOptions,
    type RequestTransformFunction,
    type MarkerOptions,
    type NavigationControlOptions,
    type PopupOptions,
    type Offset,
    type OverscaledTileID,
    type ScaleControlOptions,
    type Unit,
    type AroundCenterOptions,
    type HandlerResult,
    type CustomRenderMethodInput,
    type ExpiryData,
    type PositionAnchor,
    type ProjectionData,
    type GeoJSONFeatureId,
    type GeoJSONFeatureDiff,
    type TextFit,
    type TransformStyleFunction,
    type DistributiveOmit,
    type DistributiveKeys,
    type RequestParameters,
    type RequestResponseMessageMap,
    type WorkerTileResult,
    type ResourceType,
    type Dispatcher,
    type Actor,
    type IActor,
    type ActorMessage,
    type Bucket,
    type CollisionBoxArray,
    type FeatureIndex,
    type AlphaImage,
    type GlyphPositions,
    type GlyphPosition,
    type ImageAtlas,
    type MessageType,
    type StyleGlyph,
    type MapOptions,
    type GestureOptions,
    type WebGLContextAttributesWithType,
    type IControl,
    type CustomLayerInterface,
    type CanvasSourceSpecification,
    type PaddingOptions,
    type LngLatLike,
    type PointLike,
    type LngLatBoundsLike,
    type Source,
    type MapProjectionEvent,
    type MapTerrainEvent,
    type MapStyleImageMissingEvent,
    type MapStyleDataEvent,
    type MapSourceDataEvent,
    type MapLibreZoomEvent,
    type MapLibreEvent,
    type MapLayerTouchEvent,
    type MapLayerMouseEvent,
    type MapLayerEventType,
    type MapEventType,
    type MapDataEvent,
    type MapContextEvent,
    type ErrorEvent,
    type GeoJSONFeature,
    type CoveringTilesOptions,
    setRTLTextPlugin,
    getRTLTextPluginStatus,
    prewarm,
    clearPrewarmedResources,
    getVersion,
    getWorkerCount,
    setWorkerCount,
    getMaxParallelImageRequests,
    setMaxParallelImageRequests,
    getWorkerUrl,
    setWorkerUrl,
    addProtocol,
    removeProtocol,
    addSourceType,
    importScriptInWorkers,
    createTileMesh
};
