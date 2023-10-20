const cache = new WeakMap();
export function isWebGL2(
    gl: WebGLRenderingContext | WebGL2RenderingContext
): gl is WebGL2RenderingContext {
    if (cache.has(gl)) {
        return cache.get(gl);
    } else {
        const value = gl.getParameter(gl.VERSION)?.startsWith('WebGL 2.0');
        cache.set(gl, value);
        return value;
    }
}
