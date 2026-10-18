# Hash

Defined in: [ui/hash.ts:13](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/ui/hash.ts#L13>)

Adds the map's position to its page's location hash. Passed as an option to the map object.

## Methods

### addTo()

> **addTo**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>)): `this`

Defined in: [ui/hash.ts:26](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/ui/hash.ts#L26>)

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

Defined in: [ui/hash.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/ui/hash.ts#L36>)

Removes hash

#### Returns

`this`

## Properties

### \_updateHash

> **\_updateHash**: () =\> `Timeout`

Defined in: [ui/hash.ts:138](<https://github.com/maplibre/maplibre-gl-js/blob/638b3f9ecab4b743fd4d086d3bfd19bce7b7b032/src/ui/hash.ts#L138>)

Mobile Safari doesn't allow updating the hash more than 100 times per 30 seconds.

#### Returns

`Timeout`
