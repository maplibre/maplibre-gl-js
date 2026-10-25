# removeProjection()

> **removeProjection**(`name`: `string`): `void`

Defined in: [geo/projection/projection\_crud.ts:75](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/geo/projection/projection_crud.ts#L75>)

**`Experimental`**

Removes a projection registered with [addProjection](<https://maplibre.org/maplibre-gl-js/docs/API/functions/addProjection/index.md>). Maps currently using it keep working until their projection changes. Built-in projections, whose names have no colon, cannot be removed.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `name` | `string` | the name the projection was registered with |

## Returns

`void`

## Throws

Error if the name has no colon

## Example

```ts
removeProjection('EPSG:2193');
```
