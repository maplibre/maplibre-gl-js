import {StyleLayer} from '../style_layer';
import type {Map} from '../../ui/map';
import {type mat4} from 'gl-matrix';
import {type LayerSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {ProjectionData} from '../../geo/projection/projection_data';

/**
* Input arguments exposed by custom render function.
*/
export type CustomRenderMethodInput = {
    /**
     * This value represents the distance from the camera to the far clipping plane.
     * It is used in the calculation of the projection matrix to determine which objects are visible.
     * farZ should be larger than nearZ.
     */
    farZ: number;
    /**
     * This value represents the distance from the camera to the near clipping plane.
     * It is used in the calculation of the projection matrix to determine which objects are visible.
     * nearZ should be smaller than farZ.
     */
    nearZ: number;
    /**
     * Vertical field of view in radians.
     */
    fov: number;
    /**
    * model view projection matrix
    * represents the matrix converting from world space to clip space
    * https://learnopengl.com/Getting-started/Coordinate-Systems
    * **/
    modelViewProjectionMatrix: mat4;
    /**
    * projection matrix
    * represents the matrix converting from view space to clip space
    * https://learnopengl.com/Getting-started/Coordinate-Systems
    */
    projectionMatrix: mat4;
    /**
     * Data required for picking and compiling a custom shader for the current projection.
     */
    shaderData: {
        /**
         * Name of the shader variant that should be used.
         * Depends on current projection.
         * Whenever the other shader properties change, this string changes as well,
         * and can be used as a key with which to cache compiled shaders.
         */
        variantName: string;
        /**
         * The prelude code to add to the vertex shader to access MapLibre's `projectTile` projection function.
         * Depends on current projection.
         * @example
         * ```
         * const vertexSource = `#version 300 es
         * ${shaderData.vertexShaderPrelude}
         * ${shaderData.define}
         * in vec2 a_pos;
         * void main() {
         *     gl_Position = projectTile(a_pos);
         * }`;
         * ```
         */
        vertexShaderPrelude: string;
        /**
         * Defines to add to the shader code.
         * Depends on current projection.
         * @example
         * ```
         * const vertexSource = `#version 300 es
         * ${shaderData.vertexShaderPrelude}
         * ${shaderData.define}
         * in vec2 a_pos;
         * void main() {
         *     gl_Position = projectTile(a_pos);
         *     #ifdef GLOBE
         *     // Do globe-specific things
         *     #endif
         * }`;
         * ```
         */
        define: string;
    };
    /**
     * Uniforms that should be passed to the vertex shader, if MapLibre's projection code is used.
     * For more details of this object's internals, see its doc comments in `src/geo/projection/projection_data.ts`.
     *
     * These uniforms are set so that `projectTile` in shader accepts a vec2 in range 0..1 in web mercator coordinates.
     * Use `map.transform.getProjectionData({overscaledTileID: tileID})` to get uniforms for a given tile and pass vec2 in tile-local range 0..EXTENT instead.
     *
     * For projection 3D features, use `projectTileFor3D` in the shader.
     *
     * If you just need a projection matrix, use `defaultProjectionData.projectionMatrix`.
     * A projection matrix is sufficient for simple custom layers that also only support mercator projection.
     *
     * Under mercator projection, when these uniforms are used, the shader's `projectTile` function projects spherical mercator
     * coordinates to gl clip space coordinates. The spherical mercator coordinate `[0, 0]` represents the
     * top left corner of the mercator world and `[1, 1]` represents the bottom right corner. When
     * the `renderingMode` is `"3d"`, the z coordinate is conformal. A box with identical x, y, and z
     * lengths in mercator units would be rendered as a cube. {@link MercatorCoordinate.fromLngLat}
     * can be used to project a `LngLat` to a mercator coordinate.
     *
     * Under globe projection, when these uniforms are used, the `elevation` parameter
     * passed to `projectTileFor3D` in the shader is elevation in meters above "sea level",
     * or more accurately for globe, elevation above the surface of the perfect sphere used to render the planet.
     */
    defaultProjectionData: ProjectionData;
};

/**
 * @param gl - The map's gl context.
 * @param options - Argument object with render inputs like camera properties.
 */
type CustomRenderMethod = (gl: WebGLRenderingContext|WebGL2RenderingContext, options: CustomRenderMethodInput) => void;

/**
 * Interface for custom style layers. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Custom layers allow a user to render directly into the map's GL context using the map's camera.
 * These layers can be added between any regular layers using {@link Map.addLayer}.
 *
 * Custom layers must have a unique `id` and must have the `type` of `"custom"`.
 * They must implement `render` and may implement `prerender`, `onAdd` and `onRemove`.
 * They can trigger rendering using {@link Map.triggerRepaint}
 * and they should appropriately handle {@link MapContextEvent} with `webglcontextlost` and `webglcontextrestored`.
 *
 * The `renderingMode` property controls whether the layer is treated as a `"2d"` or `"3d"` map layer. Use:
 *
 * - `"renderingMode": "3d"` to use the depth buffer and share it with other layers
 * - `"renderingMode": "2d"` to add a layer with no depth. If you need to use the depth buffer for a `"2d"` layer you must use an offscreen
 *   framebuffer and {@link CustomLayerInterface.prerender}
 *
 * @example
 * Custom layer implemented as ES6 class
 * ```ts
 * class NullIslandLayer {
 *     constructor() {
 *         this.id = 'null-island';
 *         this.type = 'custom';
 *         this.renderingMode = '2d';
 *     }
 *
 *      onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
 *         const vertexSource = `
 *         uniform mat4 u_matrix;
 *         void main() {
 *             gl_Position = u_matrix * vec4(0.5, 0.5, 0.0, 1.0);
 *             gl_PointSize = 20.0;
 *         }`;
 *
 *         const fragmentSource = `
 *         void main() {
 *             fragColor = vec4(1.0, 0.0, 0.0, 1.0);
 *         }`;
 *
 *         const vertexShader = gl.createShader(gl.VERTEX_SHADER);
 *         gl.shaderSource(vertexShader, vertexSource);
 *         gl.compileShader(vertexShader);
 *         const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
 *         gl.shaderSource(fragmentShader, fragmentSource);
 *         gl.compileShader(fragmentShader);
 *
 *         this.program = gl.createProgram();
 *         gl.attachShader(this.program, vertexShader);
 *         gl.attachShader(this.program, fragmentShader);
 *         gl.linkProgram(this.program);
 *     }
 *
 *     render({
 *      gl,
 *      modelViewProjectionMatrix: matrix
 *      }: {
 *      gl: WebGLRenderingContext | WebGL2RenderingContext;
 *      modelViewProjectionMatrix: Float32Array;
 *      }) {
 *         gl.useProgram(this.program);
 *         gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
 *         gl.drawArrays(gl.POINTS, 0, 1);
 *     }
 * }
 *
 * map.on('load', () => {
 *     map.addLayer(new NullIslandLayer());
 * });
 * ```
 */
export interface CustomLayerInterface {
    /**
     * A unique layer id.
     */
    id: string;
    /**
     * The layer's type. Must be `"custom"`.
     */
    type: 'custom';
    /**
     * Either `"2d"` or `"3d"`. Defaults to `"2d"`.
     */
    renderingMode?: '2d' | '3d';
    /**
     * Called during a render frame allowing the layer to draw into the GL context.
     *
     * The layer can assume blending and depth state is set to allow the layer to properly
     * blend and clip other layers. The layer cannot make any other assumptions about the
     * current GL state.
     *
     * If the layer needs to render to a texture, it should implement the `prerender` method
     * to do this and only use the `render` method for drawing directly into the main framebuffer.
     *
     * The blend function is set to `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`. This expects
     * colors to be provided in premultiplied alpha form where the `r`, `g` and `b` values are already
     * multiplied by the `a` value. If you are unable to provide colors in premultiplied form you
     * may want to change the blend function to
     * `gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`.
     */
    render: CustomRenderMethod;
    /**
     * Optional method called during a render frame to allow a layer to prepare resources or render into a texture.
     *
     * The layer cannot make any assumptions about the current GL state and must bind a framebuffer before rendering.
     */
    prerender?: CustomRenderMethod;
    /**
     * Optional method called when the layer has been added to the Map with {@link Map.addLayer}. This
     * gives the layer a chance to initialize gl resources and register event listeners.
     *
     * @param map - The Map this custom layer was just added to.
     * @param gl - The gl context for the map.
     */
    onAdd?(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    /**
     * Optional method called when the layer has been removed from the Map with {@link Map.removeLayer}. This
     * gives the layer a chance to clean up gl resources and event listeners.
     *
     * @param map - The Map this custom layer was just added to.
     * @param gl - The gl context for the map.
     */
    onRemove?(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
}

export function validateCustomStyleLayer(layerObject: CustomLayerInterface) {
    const errors = [];
    const id = layerObject.id;

    if (id === undefined) {
        errors.push({
            message: `layers.${id}: missing required property "id"`
        });
    }

    if (layerObject.render === undefined) {
        errors.push({
            message: `layers.${id}: missing required method "render"`
        });
    }

    if (layerObject.renderingMode &&
        layerObject.renderingMode !== '2d' &&
        layerObject.renderingMode !== '3d') {
        errors.push({
            message: `layers.${id}: property "renderingMode" must be either "2d" or "3d"`
        });
    }

    return errors;
}

export const isCustomStyleLayer = (layer: StyleLayer): layer is CustomStyleLayer => layer.type === 'custom';

export class CustomStyleLayer extends StyleLayer {

    implementation: CustomLayerInterface;

    constructor(implementation: CustomLayerInterface) {
        super(implementation, {});
        this.implementation = implementation;
    }

    is3D() {
        return this.implementation.renderingMode === '3d';
    }

    hasOffscreenPass() {
        return this.implementation.prerender !== undefined;
    }

    recalculate() {}
    updateTransitions() {}
    hasTransition() { return false; }

    serialize(): LayerSpecification {
        throw new Error('Custom layers cannot be serialized');
    }

    onAdd = (map: Map) => {
        if (this.implementation.onAdd) {
            this.implementation.onAdd(map, map.painter.context.gl);
        }
    };

    onRemove = (map: Map) => {
        if (this.implementation.onRemove) {
            this.implementation.onRemove(map, map.painter.context.gl);
        }
    };
}
