# StyleImageInterface

Defined in: [style/style\_image.ts:191](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L191>)

Interface for dynamically generated style images. This is a specification for implementers to model: it is not an exported method or class.

Images implementing this interface can be redrawn for every frame. They can be used to animate icons and patterns or make them respond to user input. Style images can implement a [StyleImageInterface.render](<#render>) method. The method is called every frame and can be used to update the image.

## See

[Add an animated icon to the map.](<https://maplibre.org/maplibre-gl-js/docs/examples/add-image-animated/>)

## Example

```ts
let flashingSquare = {
    width: 64,
    height: 64,
    data: new Uint8Array(64 * 64 * 4),

    onAdd: function(map) {
        this.map = map;
    },

    render: function() {
        // keep repainting while the icon is on the map
        this.map.triggerRepaint();

        // alternate between black and white based on the time
        let value = Math.round(Date.now() / 1000) % 2 === 0  ? 255 : 0;

        // check if image needs to be changed
        if (value !== this.previousValue) {
            this.previousValue = value;

            let bytesPerPixel = 4;
            for (let x = 0; x < this.width; x++) {
                for (let y = 0; y < this.height; y++) {
                    let offset = (y * this.width + x) * bytesPerPixel;
                    this.data[offset + 0] = value;
                    this.data[offset + 1] = value;
                    this.data[offset + 2] = value;
                    this.data[offset + 3] = 255;
                }
            }

            // return true to indicate that the image changed
            return true;
        }
    }
 }

 map.addImage('flashing_square', flashingSquare);
```

## Properties

### data

> **data**: `Uint8Array`\<`ArrayBufferLike`\> | `Uint8ClampedArray`\<`ArrayBufferLike`\> | [`StyleImageWebGLData`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLData/index.md>)

Defined in: [style/style\_image.ts:200](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L200>)

The image's pixels, in the same format as `ImageData`, or a [StyleImageWebGLData](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLData/index.md>) callback that renders them with WebGL. A WebGL image renders straight into its slot of the shared icon atlas. Nothing new is possible that pixels could not express, but an image that changes often, such as an animated icon, gets much cheaper: no CPU pixel work and no upload.

---

### onAdd?

> `optional` **onAdd?**: (`map`: [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>), `id`: `string`) =\> `void`

Defined in: [style/style\_image.ts:225](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L225>)

Optional method called when the layer has been added to the Map with [Map.addImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#addimage>).

#### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `map` | [`Map`](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/index.md>) | The Map this custom layer was just added to. |
| `id` | `string` | \- |

#### Returns

`void`

---

### onRemove?

> `optional` **onRemove?**: () =\> `void`

Defined in: [style/style\_image.ts:234](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L234>)

Optional method called when the icon is removed from the map with [Map.removeImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#removeimage>). This gives the image a chance to clean up resources and event listeners.

This also fires when the WebGL context is lost, after which the same image is added back without a matching `onAdd`, so the image has to be able to build again whatever it released here.

#### Returns

`void`

---

### render?

> `optional` **render?**: () =\> `boolean`

Defined in: [style/style\_image.ts:219](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/style/style_image.ts#L219>)

This method is called once before every frame where the icon will be used. The method can optionally update the image's `data` member with a new image.

If the method updates the image it must return `true` to commit the change. If the method returns `false` or nothing the image is assumed to not have changed.

An animated image schedules its next frame by calling [Map.triggerRepaint](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#triggerrepaint>), typically from a timer; returning `false` in between lets the map rest and fire `idle`.

An image whose `data` renders with WebGL has nothing to update here; returning `true` is how it asks for [StyleImageWebGLData.renderWithWebGL](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/StyleImageWebGLData/#renderwithwebgl>) to be called again.

If updates are infrequent it maybe easier to use [Map.updateImage](<https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#updateimage>) to update the image instead of implementing this method.

#### Returns

`boolean`

`true` if this method updated the image. `false` if the image was not changed.
