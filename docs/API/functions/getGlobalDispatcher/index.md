# getGlobalDispatcher()

> **getGlobalDispatcher**(): [`Dispatcher`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Dispatcher/index.md>)

Defined in: [util/dispatcher.ts:116](<https://github.com/maplibre/maplibre-gl-js/blob/7976a989280508d763265f95f523e945d04d87b0/src/util/dispatcher.ts#L116>)

This function is used to get the global dispatcher that is shared across all maps instances. It is used by the main thread to send messages to the workers, and by the workers to send messages back to the main thread. If you import a script into the worker and need to send a message to the workers to pass some parameters for example, you can use this function to get the global dispatcher and send a message to the workers.

## Returns

[`Dispatcher`](<https://maplibre.org/maplibre-gl-js/docs/API/interfaces/Dispatcher/index.md>)

The global dispatcher instance.
