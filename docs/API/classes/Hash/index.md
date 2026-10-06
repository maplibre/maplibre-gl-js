# Hash

Defined in: [ui/hash.ts:12](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/hash.ts#L12>)

Adds the map's position to its page's location hash. Passed as an option to the map object.

## Methods

### addTo()

> **addTo**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `this`

Defined in: [ui/hash.ts:25](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/hash.ts#L25>)

Map element to listen for coordinate changes

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The map object |

#### Returns

`this`

---

### remove()

> **remove**(): `this`

Defined in: [ui/hash.ts:35](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/hash.ts#L35>)

Removes hash

#### Returns

`this`

## Properties

### \_updateHash

> **\_updateHash**: () =\> `Timeout`

Defined in: [ui/hash.ts:136](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/hash.ts#L136>)

Mobile Safari doesn't allow updating the hash more than 100 times per 30 seconds.

#### Returns

`Timeout`
