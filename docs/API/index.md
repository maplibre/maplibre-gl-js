# Intro

This file is intended as a reference for the important and public classes of this API. We recommend looking at the [examples](<https://maplibre.org/maplibre-gl-js/docs/examples/index.md>) as they will help you the most to start with MapLibre.

Most of the classes written here have an "Options" object for initialization, it is recommended to check which options exist.

It is recommended to import what you need and then use it. Some examples for classes assume you did that. For example, import the `Map` class like this:

```ts
import {Map} from 'maplibre-gl';
const map = new Map(...)
```

Import declarations are omitted from the examples for brevity.

## Main

- [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)

## Markers and Controls

- [AttributionControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/AttributionControl/index.md>)
- [FullscreenControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenControl/index.md>)
- [GeolocateControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl/index.md>)
- [GlobeControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GlobeControl/index.md>)
- [Hash](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Hash/index.md>)
- [LogoControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LogoControl/index.md>)
- [Marker](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/index.md>)
- [NavigationControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/NavigationControl/index.md>)
- [Popup](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Popup/index.md>)
- [ScaleControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScaleControl/index.md>)
- [TerrainControl](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TerrainControl/index.md>)

## Geography and Geometry

- [EdgeInsets](<https://maplibre.org/maplibre-gl-js/docs/API/classes/EdgeInsets/index.md>)
- [LngLat](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLat/index.md>)
- [LngLatBounds](<https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/index.md>)
- [MercatorCoordinate](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MercatorCoordinate/index.md>)
- [LngLatBoundsLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatBoundsLike/index.md>)
- [LngLatLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/LngLatLike/index.md>)
- [PaddingOptions](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/index.md>)
- [PointLike](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PointLike/index.md>)

## Handlers

- [BoxZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/BoxZoomHandler/index.md>)
- [CooperativeGesturesHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CooperativeGesturesHandler/index.md>)
- [DoubleClickZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DoubleClickZoomHandler/index.md>)
- [DragPanHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragPanHandler/index.md>)
- [DragRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/DragRotateHandler/index.md>)
- [KeyboardHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/KeyboardHandler/index.md>)
- [ScrollZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/index.md>)
- [TwoFingersTouchPitchHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchPitchHandler/index.md>)
- [TwoFingersTouchRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchRotateHandler/index.md>)
- [TwoFingersTouchZoomHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomHandler/index.md>)
- [TwoFingersTouchZoomRotateHandler](<https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/index.md>)

## Sources

- [CanvasSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/CanvasSource/index.md>)
- [GeoJSONSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/index.md>)
- [ImageSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/index.md>)
- [RasterDEMTileSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterDEMTileSource/index.md>)
- [VectorTileSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/VectorTileSource/index.md>)
- [VideoSource](<https://maplibre.org/maplibre-gl-js/docs/API/classes/VideoSource/index.md>)
- [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>)

## Event Related

- [Evented](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Evented/index.md>)
- [FullscreenEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/FullscreenEvent/index.md>)
- [GeolocateErrorEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateErrorEvent/index.md>)
- [GeolocateEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateEvent/index.md>)
- [GeolocatePositionEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocatePositionEvent/index.md>)
- [MapBoxZoomEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapBoxZoomEvent/index.md>)
- [MapContextEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>)
- [MapLibreEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapLibreEvent/index.md>)
- [MapMouseEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMouseEvent/index.md>)
- [MapMovementEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapMovementEvent/index.md>)
- [MapProjectionEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapProjectionEvent/index.md>)
- [MapSourceDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)
- [MapStyleDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleDataEvent/index.md>)
- [MapStyleImageMissingEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleImageMissingEvent/index.md>)
- [MapStyleLoadEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapStyleLoadEvent/index.md>)
- [MapTerrainEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTerrainEvent/index.md>)
- [MapTouchEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapTouchEvent/index.md>)
- [MapWheelEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapWheelEvent/index.md>)
- [MarkerClickEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerClickEvent/index.md>)
- [MarkerDragEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MarkerDragEvent/index.md>)
- [PopupEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/PopupEvent/index.md>)
- [FullscreenControlEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/FullscreenControlEventType/index.md>)
- [GeolocateControlEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/GeolocateControlEventType/index.md>)
- [MapEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/index.md>)
- [MapLayerEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerEventType/index.md>)
- [MapLayerMouseEvent](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerMouseEvent/index.md>)
- [MapLayerTouchEvent](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapLayerTouchEvent/index.md>)
- [MarkerEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerEventType/index.md>)
- [PopupEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PopupEventType/index.md>)
- [SourceEventType](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/SourceEventType/index.md>)
