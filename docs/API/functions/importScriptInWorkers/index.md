# importScriptInWorkers()

> **importScriptInWorkers**(`workerUrl`: `string`): `Promise`\<`void`\>

Defined in: [index.ts:209](<https://github.com/maplibre/maplibre-gl-js/blob/f67ac5e45ce441c6eef7c395ad2bbde7ed717c5d/src/index.ts#L209>)

Allows loading javascript code in the worker thread. *Note* that since this is using some very internal classes and flows it is considered experimental and can break at any point.

It can be useful for the following examples: 1. Using `self.addProtocol` in the worker thread - note that you might need to also register the protocol on the main thread. 2. Using `self.registerWorkerSource(workerSource: WorkerSource)` to register a worker source, which should come with `addSourceType` usually. 3. using `self.actor.registerMessageHandler` to override some internal worker operations

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `workerUrl` | `string` | the worker url e.g. a url of a javascript file to load in the worker |

## Returns

`Promise`\<`void`\>

## Example

```ts
// below is an example of sending a js file to the worker to load the method there
// Note that you'll need to call the global function `addProtocol` in the worker to register the protocol there.
// add-protocol-worker.js
async function loadFn(params, abortController) {
    const t = await fetch(`https://${params.url.split("://")[1]}`);
    if (t.status == 200) {
        const buffer = await t.arrayBuffer();
        return {data: buffer}
    } else {
        throw new Error(`Tile fetch error: ${t.statusText}`);
    }
}
self.addProtocol('custom', loadFn);

// main.js
importScriptInWorkers('add-protocol-worker.js');
```
