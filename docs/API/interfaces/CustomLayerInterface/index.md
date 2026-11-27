# CustomLayerInterface

Defined in: [style/style\_layer/custom\_style\_layer.ts:272](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L272>)

Interface for custom style layers. This is a specification for implementers to model: it is not an exported method or class.

Custom layers allow a user to render directly into the map's GL context using the map's camera. These layers can be added between any regular layers using [Map.addLayer](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#addlayer>).

Custom layers must have a unique `id` and must have the `type` of `"custom"`. They must implement `render` and may implement `prerender`, `onAdd` and `onRemove`. They can trigger rendering using [Map.triggerRepaint](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#triggerrepaint>) and they should appropriately handle [MapContextEvent](<https://maplibre.org/maplibre-gl-js/docs/API/classes/MapContextEvent/index.md>) with `webglcontextlost` and `webglcontextrestored`.

The `renderingMode` property controls whether the layer is treated as a `"2d"` or `"3d"` map layer. Use:

- `"renderingMode": "3d"` to use the depth buffer and share it with other layers
- `"renderingMode": "2d"` to add a layer with no depth. If you need to use the depth buffer for a `"2d"` layer you must use an offscreen framebuffer and [CustomLayerInterface.prerender](<#prerender>)

## Example

Custom layer implemented as ES6 class

```ts
class NullIslandLayer {
    constructor() {
        this.id = 'null-island';
        this.type = 'custom';
        this.renderingMode = '2d';
    }

     onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext) {
        const vertexSource = `
        uniform mat4 u_matrix;
        void main() {
            gl_Position = u_matrix * vec4(0.5, 0.5, 0.0, 1.0);
            gl_PointSize = 20.0;
        }`;

        const fragmentSource = `
        void main() {
            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
    }

    render({
     gl,
     modelViewProjectionMatrix: matrix
     }: {
     gl: WebGL2RenderingContext;
     modelViewProjectionMatrix: Float32Array;
     }) {
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}

map.on('load', () => {
    map.addLayer(new NullIslandLayer());
});
```

## Methods

### onAdd()?

> `optional` **onAdd**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>), `gl`: `WebGL2RenderingContext`): `void`

Defined in: [style/style\_layer/custom\_style\_layer.ts:330](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L330>)

Optional method called when the layer has been added to the Map with [Map.addLayer](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#addlayer>). This gives the layer a chance to initialize gl resources and register event listeners.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The Map this custom layer was just added to. |
| `gl` | `WebGL2RenderingContext` | The gl context for the map. |

#### Returns

`void`

---

### onRemove()?

> `optional` **onRemove**(`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>), `gl`: `WebGL2RenderingContext`): `void`

Defined in: [style/style\_layer/custom\_style\_layer.ts:338](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L338>)

Optional method called when the layer has been removed from the Map with [Map.removeLayer](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#removelayer>). This gives the layer a chance to clean up gl resources and event listeners.

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The Map this custom layer was just added to. |
| `gl` | `WebGL2RenderingContext` | The gl context for the map. |

#### Returns

`void`

## Properties

### id

> **id**: `string`

Defined in: [style/style\_layer/custom\_style\_layer.ts:276](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L276>)

A unique layer id.

---

### prerender?

> `optional` **prerender?**: [`CustomRenderMethod`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethod/index.md>)

Defined in: [style/style\_layer/custom\_style\_layer.ts:307](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L307>)

Optional method called during a render frame to allow a layer to prepare resources or render into a texture.

The layer cannot make any assumptions about the current GL state and must bind a framebuffer before rendering.

---

### render

> **render**: [`CustomRenderMethod`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomRenderMethod/index.md>)

Defined in: [style/style\_layer/custom\_style\_layer.ts:301](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L301>)

Called during a render frame allowing the layer to draw into the GL context.

The layer can assume blending and depth state is set to allow the layer to properly blend and clip other layers. The layer cannot make any other assumptions about the current GL state.

If the layer needs to render to a texture, it should implement the `prerender` method to do this and only use the `render` method for drawing directly into the main framebuffer.

The blend function is set to `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`. This expects colors to be provided in premultiplied alpha form where the `r`, `g` and `b` values are already multiplied by the `a` value. If you are unable to provide colors in premultiplied form you may want to change the blend function to `gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`.

---

### renderingMode?

> `optional` **renderingMode?**: `"2d"` | `"3d"`

Defined in: [style/style\_layer/custom\_style\_layer.ts:284](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L284>)

Either `"2d"` or `"3d"`. Defaults to `"2d"`.

---

### renderToTerrainTile?

> `optional` **renderToTerrainTile?**: (`gl`: `WebGL2RenderingContext`, `options`: [`CustomTerrainRenderInput`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomTerrainRenderInput/index.md>)) =\> `void`

Defined in: [style/style\_layer/custom\_style\_layer.ts:316](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L316>)

**`Experimental`**

Optional method called instead of `render` while terrain is enabled, to draw the layer into a terrain tile that MapLibre drapes over the terrain with the fill, line and raster layers around the layer in the style. Clip space `(-1, -1)` is the tile's south-west corner and `(1, 1)` its north-east corner. Draw over what the framebuffer holds, with the same blending as `render` and without depth or stencil testing. MapLibre calls it again when it redraws the tile, and after [CustomLayerInterface.terrainTileRevision](<#terraintilerevision>) changes.

#### Parameters

| Parameter | Type |
| --- | --- |
| `gl` | `WebGL2RenderingContext` |
| `options` | [`CustomTerrainRenderInput`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CustomTerrainRenderInput/index.md>) |

#### Returns

`void`

---

### terrainTileRevision?

> `optional` **terrainTileRevision?**: `number`

Defined in: [style/style\_layer/custom\_style\_layer.ts:322](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L322>)

**`Experimental`**

Optional number that the layer changes when what it draws in [CustomLayerInterface.renderToTerrainTile](<#rendertoterraintile>) changes, before calling [Map.triggerRepaint](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md#triggerrepaint>), so that MapLibre draws the terrain tiles again.

---

### type

> **type**: `"custom"`

Defined in: [style/style\_layer/custom\_style\_layer.ts:280](<https://github.com/maplibre/maplibre-gl-js/blob/0a5b073a639c4b2855901c1ba8e0bb351d768243/src/style/style_layer/custom_style_layer.ts#L280>)

The layer's type. Must be `"custom"`.
