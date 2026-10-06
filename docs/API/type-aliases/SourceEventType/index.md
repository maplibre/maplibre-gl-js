# SourceEventType

> **SourceEventType** = `object`

Defined in: [ui/events.ts:459](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L459>)

`SourceEventType` - a mapping between the source data event names and their event value. These are the events fired by a [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>) as its data loads or changes; they also bubble up to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>). See [MapSourceDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) for the event shape.

## Properties

### data

> **data**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:463](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L463>)

Fired when the source's data loads or changes.

---

### dataabort

> **dataabort**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:471](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L471>)

Fired when a request for the source's data is aborted.

---

### dataloading

> **dataloading**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:467](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L467>)

Fired when the source begins loading or changing data.

---

### error

> **error**: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)

Defined in: [ui/events.ts:475](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/events.ts#L475>)

Fired when there's an error
