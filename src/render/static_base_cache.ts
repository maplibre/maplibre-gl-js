import {Texture} from '../webgl/texture.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {StencilMode} from '../webgl/stencil_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {CullFaceMode} from '../webgl/cull_face_mode.ts';
import {fullscreenTextureUniformValues} from '../webgl/program/fullscreen_texture_program.ts';

import type {Painter} from './painter.ts';
import type {StyleLayer} from '../style/style_layer.ts';

type PainterOptions = {
    moving: boolean;
    rotating: boolean;
    zooming: boolean;
};

/**
 * Caches the screen content after rendering the first N stable translucent
 * layers, and reuses that snapshot on subsequent frames to avoid redundant
 * re-rendering when only upper layers change and the camera is static.
 */
export class StaticBaseCache {
    _texture: Texture | null = null;
    _cachedLayerCount: number = 0;
    _width: number = 0;
    _height: number = 0;
    enabled: boolean = true;
    stabilityThreshold: number = 3;
    minLayers: number = 5;

    /**
     * Determine how the translucent pass should be rendered: from cache,
     * with a snapshot to build the cache, or normally.
     *
     * @returns An object with:
     *   - `cacheStartLayer`: index at which the main rendering loop should start
     *   - `needsSnapshot`: whether to call {@link snapshot} after rendering layer `stableLayerCount - 1`
     *   - `stableLayerCount`: number of consecutive stable layers from the bottom
     */
    prepareTranslucentPass(
        painter: Painter,
        layerIds: string[],
        layers: {[_: string]: StyleLayer},
        zoom: number,
        options: PainterOptions,
    ): {cacheStartLayer: number; needsSnapshot: boolean; stableLayerCount: number} {
        // Compute N: number of consecutive stable layers from the bottom
        let stableLayerCount = 0;
        if (this.enabled) {
            for (const layerId of layerIds) {
                const layer = layers[layerId];
                if (layer.isHidden(zoom)) {
                    // Hidden layers don't break the stable chain — they won't be rendered anyway
                    stableLayerCount++;
                    continue;
                }
                if (layer._unchangedFrameCount >= this.stabilityThreshold) {
                    stableLayerCount++;
                } else {
                    break;
                }
            }
        }

        // Invalidate cache during any camera movement
        const cameraMoving = options.moving || options.zooming || options.rotating;
        if (cameraMoving) {
            this._cachedLayerCount = 0;
        }

        // Check if existing cache is still valid
        const cacheValid = this._cachedLayerCount > 0 &&
            stableLayerCount >= this._cachedLayerCount &&
            this._width === painter.width &&
            this._height === painter.height;

        let cacheStartLayer = 0;
        let needsSnapshot = false;

        if (cacheValid) {
            // Reuse existing cache — blit cached texture then skip to remaining layers
            this._draw(painter);
            painter.clearStencil();
            cacheStartLayer = this._cachedLayerCount;
        } else if (!cameraMoving && stableLayerCount >= this.minLayers) {
            // Will render these layers normally, then snapshot the screen
            needsSnapshot = true;
            this._cachedLayerCount = 0;
        } else {
            // Not enough stable layers or camera moving — no caching
            this._cachedLayerCount = 0;
        }

        return {cacheStartLayer, needsSnapshot, stableLayerCount};
    }

    /**
     * Copy the current screen framebuffer into the cache texture.
     * Call this after rendering the first N stable translucent layers to
     * the main framebuffer.
     */
    snapshot(painter: Painter, layerCount: number): void {
        const context = painter.context;
        const gl = context.gl;

        // Create or resize the cache texture
        if (!this._texture ||
            this._width !== painter.width ||
            this._height !== painter.height) {
            if (this._texture) {
                this._texture.destroy();
            }
            this._texture = new Texture(context, {width: painter.width, height: painter.height, data: null}, gl.RGBA);
            this._texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            this._width = painter.width;
            this._height = painter.height;
        }

        // Copy the current screen framebuffer into the cache texture
        gl.bindTexture(gl.TEXTURE_2D, this._texture.texture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, painter.width, painter.height);

        this._cachedLayerCount = layerCount;
    }

    /**
     * Draw the cached texture as a fullscreen quad.
     * Uses unblended (replace) mode since the snapshot includes the full
     * screen content (opaque pass + cached translucent layers).
     */
    _draw(painter: Painter): void {
        const context = painter.context;
        const gl = context.gl;

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture.texture);

        const program = painter.useProgram('fullscreenTexture', null, true);

        program.draw(
            context,
            gl.TRIANGLES,
            DepthMode.disabled,
            StencilMode.disabled,
            ColorMode.unblended,
            CullFaceMode.disabled,
            fullscreenTextureUniformValues(0),
            null,
            undefined,
            '$fullscreenTexture',
            painter.viewportBuffer,
            painter.quadTriangleIndexBuffer,
            painter.viewportSegments,
        );
    }

    invalidate(): void {
        this._cachedLayerCount = 0;
    }

    destroy(): void {
        if (this._texture) {
            this._texture.destroy();
            this._texture = null;
        }
    }
}
