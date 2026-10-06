# CalculateTileZoomFunction

> **CalculateTileZoomFunction** = (`requestedCenterZoom`: `number`, `distanceToTile2D`: `number`, `distanceToTileZ`: `number`, `distanceToCenter3D`: `number`, `cameraVerticalFOV`: `number`) =\> `number`

Defined in: [geo/projection/covering\_tiles.ts:81](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/geo/projection/covering_tiles.ts#L81>)

Function to define how tiles are loaded at high pitch angles

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `requestedCenterZoom` | `number` | the requested zoom level, valid at the center point. |
| `distanceToTile2D` | `number` | 2D distance from the camera to the candidate tile, in mercator units. |
| `distanceToTileZ` | `number` | vertical distance from the camera to the candidate tile, in mercator units. |
| `distanceToCenter3D` | `number` | distance from camera to center point, in mercator units |
| `cameraVerticalFOV` | `number` | camera vertical field of view, in degrees |

## Returns

`number`

the desired zoom level for this tile. May not be an integer.
