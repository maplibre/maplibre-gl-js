export function isWebGL2(
    gl: WebGLRenderingContext | WebGL2RenderingContext
): gl is WebGL2RenderingContext {
    // this method is really faster than fetching a cache:
    return typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
}
