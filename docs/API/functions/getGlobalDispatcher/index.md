# getGlobalDispatcher()

> **getGlobalDispatcher**(): [`GlobalDispatcher`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GlobalDispatcher/index.md>)

Defined in: [util/global\_dispatcher.ts:255](<https://github.com/maplibre/maplibre-gl-js/blob/538a7680ab16d5cf5a6564ee0ce72a11be14d142/src/util/global_dispatcher.ts#L255>)

This function is used to get the global dispatcher that is shared across all maps instances. It is used by the main thread to send messages to the workers, and by the workers to send messages back to the main thread. If you import a script into the worker and need to send a message to the workers to pass some parameters for example, you can use this function to get the global dispatcher and send a message to the workers.

The same dispatcher is returned for the life of the page, so it is safe to keep, and the message handlers registered on it come back on the workers that replace terminated ones. Configuration you broadcast into the workers does not, so send that from a `workerscreate` listener.

## Returns

[`GlobalDispatcher`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/GlobalDispatcher/index.md>)

The global dispatcher instance.
