# TwoFingersTouchPitchHandler

Defined in: [ui/handler/two\_fingers\_touch.ts:289](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/two_fingers_touch.ts#L289>)

The `TwoFingersTouchPitchHandler` allows the user to pitch the map by dragging up and down with two fingers.

## Extends

- `TwoFingersTouchHandler`

## Methods

### disable()

> **disable**(): `void`

Defined in: [ui/handler/two\_fingers\_touch.ts:109](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/two_fingers_touch.ts#L109>)

Disables the "drag to pitch" interaction.

#### Returns

`void`

#### Example

```ts
map.touchPitch.disable();
```

#### Inherited from

`TwoFingersTouchHandler.disable`

---

### enable()

> **enable**(`options?`: `boolean` | [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>)): `void`

Defined in: [ui/handler/two\_fingers\_touch.ts:96](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/two_fingers_touch.ts#L96>)

Enables the "drag to pitch" interaction.

#### Parameters

| Parameter | Type |
| --- | --- |
| `options?` | `boolean` \| [`AroundCenterOptions`](<https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/AroundCenterOptions/index.md>) |

#### Returns

`void`

#### Example

```ts
map.touchPitch.enable();
```

#### Inherited from

`TwoFingersTouchHandler.enable`

---

### isActive()

> **isActive**(): `boolean`

Defined in: [ui/handler/two\_fingers\_touch.ts:128](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/two_fingers_touch.ts#L128>)

Returns a Boolean indicating whether the "drag to pitch" interaction is active, i.e. currently being used.

#### Returns

`boolean`

`true` if the "drag to pitch" interaction is active.

#### Inherited from

`TwoFingersTouchHandler.isActive`

---

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: [ui/handler/two\_fingers\_touch.ts:119](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/ui/handler/two_fingers_touch.ts#L119>)

Returns a Boolean indicating whether the "drag to pitch" interaction is enabled.

#### Returns

`boolean`

`true` if the "drag to pitch" interaction is enabled.

#### Inherited from

`TwoFingersTouchHandler.isEnabled`
