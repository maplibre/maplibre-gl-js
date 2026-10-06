# prewarm()

> **prewarm**(): `void`

Defined in: [util/global\_worker\_pool.ts:36](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/util/global_worker_pool.ts#L36>)

Initializes resources like WebWorkers that can be shared across maps to lower load times in some situations. `setWorkerUrl()` and `setWorkerCount()`, if being used, must be set before `prewarm()` is called to have an effect.

By default, the lifecycle of these resources is managed automatically, and they are lazily initialized when a Map is first created. By invoking `prewarm()`, these resources will be created ahead of time, and will not be cleared when the last Map is removed from the page. This allows them to be re-used by new Map instances that are created later. They can be manually cleared by calling `clearPrewarmedResources()`. This is only necessary if your web page remains active but stops using maps altogether.

This is primarily useful when using GL-JS maps in a single page app, wherein a user would navigate between various views that can cause Map instances to constantly be created and destroyed.

## Returns

`void`

## Example

```ts
prewarm()
```
