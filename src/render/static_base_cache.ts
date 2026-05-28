import {Texture} from '../webgl/texture.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {StencilMode} from '../webgl/stencil_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {CullFaceMode} from '../webgl/cull_face_mode.ts';
import {fullscreenTextureUniformValues} from '../webgl/program/fullscreen_texture_program.ts';

import type {Context} from '../webgl/context.ts';
import type {Painter} from './painter.ts';

/**
 * Stores and retrieves a cached framebuffer snapshot as a fullscreen texture.
 */
export class StaticBaseCache {
    _texture: Texture | null = null;
    _cachedLayerCount: number = 0;
    _width: number = 0;
    _height: number = 0;

    /**
     * Copy the current screen framebuffer into the cache texture.
     * Call this after rendering the first N stable translucent layers to
     * the main framebuffer.
     */
    captureCache(context: Context, width: number, height: number, layerCount: number): void {
        const gl = context.gl;

        // Create or resize the cache texture
        if (!this._texture ||
            this._width !== width ||
            this._height !== height) {
            this._texture?.destroy();
            this._texture = new Texture(context, {width, height, data: null}, gl.RGBA);
            this._texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            this._width = width;
            this._height = height;
        }

        // Copy the current screen framebuffer into the cache texture
        gl.bindTexture(gl.TEXTURE_2D, this._texture.texture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

        this._cachedLayerCount = layerCount;
    }

    /**
     * Draw the cached texture as a fullscreen quad.
     * Uses unblended (replace) mode since the cache includes the full
     * screen content (opaque pass + cached translucent layers).
     */
    _blitCacheToScreen(painter: Painter): void {
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
        this._texture?.destroy();
        this._texture = null;
    }
}
