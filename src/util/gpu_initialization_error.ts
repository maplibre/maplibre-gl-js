/**
 * Thrown (via the map's `error` event) when a GPU rendering context cannot be created.
 *
 * Carries the canvas attributes that were requested and, when the browser provided one,
 * the originating `webglcontextcreationerror` `statusMessage`.
 * Consumers can branch on `instanceof GPUInitializationError` and inspect the cause programmatically.
 * @see https://wiki.openstreetmap.org/wiki/This_map_requires_WebGL
 */
export class GPUInitializationError extends Error {
    readonly requestedAttributes: WebGLContextAttributes;
    readonly statusMessage: string | null;

    constructor(requestedAttributes: WebGLContextAttributes, creationEvent: WebGLContextEvent | null) {
        super('Failed to initialize WebGL');
        this.name = 'GPUInitializationError';
        this.requestedAttributes = requestedAttributes;
        this.statusMessage = creationEvent?.statusMessage ?? null;
    }
}
