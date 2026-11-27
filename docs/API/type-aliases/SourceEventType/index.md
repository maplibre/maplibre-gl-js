# SourceEventType

> **SourceEventType** = `object`

Defined in: [ui/events.ts:465](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L465>)

`SourceEventType` - a mapping between the source data event names and their event value. These are the events fired by a [Source](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Source/index.md>) as its data loads or changes; they also bubble up to the [Map](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>). See [MapSourceDataEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>) for the event shape.

## Properties

### data

> **data**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:469](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L469>)

Fired when the source's data loads or changes.

---

### dataabort

> **dataabort**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:477](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L477>)

Fired when a request for the source's data is aborted.

---

### dataloading

> **dataloading**: [`MapSourceDataEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/index.md>)

Defined in: [ui/events.ts:473](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L473>)

Fired when the source begins loading or changing data.

---

### error

> **error**: [`ErrorEvent`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/ErrorEvent/index.md>)

Defined in: [ui/events.ts:481](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/ui/events.ts#L481>)

Fired when there's an error
