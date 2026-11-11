# SourceEventType

> **SourceEventType** = `object`

Defined in: [ui/events.ts:466](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L466>)

`SourceEventType` - a mapping between the source data event names and their event value. These are the events fired by a [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>) as its data loads or changes; they also bubble up to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>). See [MapSourceDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) for the event shape.

## Properties

### data

> **data**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:470](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L470>)

Fired when the source's data loads or changes.

---

### dataabort

> **dataabort**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:478](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L478>)

Fired when a request for the source's data is aborted.

---

### dataloading

> **dataloading**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:474](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L474>)

Fired when the source begins loading or changing data.

---

### error

> **error**: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)

Defined in: [ui/events.ts:482](<https://github.com/maplibre/maplibre-gl-js/blob/7ff68855dcea2c37ffa2f02932073613714692cd/src/ui/events.ts#L482>)

Fired when there's an error
