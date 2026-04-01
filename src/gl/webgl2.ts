export function isWebGL2(
    gl: WebGLRenderingContext | WebGL2RenderingContext
): gl is WebGL2RenderingContext {
    // this method is really faster than fetching a cache:
    return gl instanceof WebGL2RenderingContext;
}
