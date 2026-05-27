import {now} from '../util/time_control.ts';
import {Texture} from '../webgl/texture.ts';
import {DepthMode} from '../webgl/depth_mode.ts';
import {StencilMode} from '../webgl/stencil_mode.ts';
import {ColorMode} from '../webgl/color_mode.ts';
import {CullFaceMode} from '../webgl/cull_face_mode.ts';
import {fullscreenTextureUniformValues} from '../webgl/program/fullscreen_texture_program.ts';

import type {Context} from '../webgl/context.ts';
import type {Painter} from './painter.ts';
import type {StyleLayer} from '../style/style_layer.ts';
import type {ImageManager} from './image_manager.ts';
import type {TileManager} from '../tile/tile_manager.ts';

type PainterOptions = {
    moving: boolean;
    rotating: boolean;
    zooming: boolean;
};

type TranslucentPassPlan = {
    /** Index at which the main rendering loop should start. */
    cacheStartLayer: number;
    /** Whether to call {@link StaticBaseCache.snapshot} after rendering layer `stableLayerCount - 1`. */
    needsSnapshot: boolean;
    /** Number of consecutive stable layers from the bottom. */
    stableLayerCount: number;
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
     * Check whether a visible layer is stable enough to be cached.
     * Returns false if the layer is custom, recently changed, has a source
     * with active transitions or incomplete tiles, or uses dynamic images.
     */
    _isLayerStable(layer: StyleLayer, imageManager: ImageManager, tileManagers: {[_: string]: TileManager}): boolean {
        if (layer.type === 'custom' || layer._unchangedFrameCount < this.stabilityThreshold) {
            return false;
        }
        if (layer.source && tileManagers[layer.source]) {
            const tm = tileManagers[layer.source];
            // Sources with active transitions (e.g. video playing,
            // canvas animating) update their texture directly via GL
            // calls each frame, bypassing change detection.
            if (tm.getSource().hasTransition?.()) {
                return false;
            }
            // Don't cache layers whose tiles are still loading — the
            // snapshot would capture incomplete content (e.g. missing symbols).
            if (!tm.loaded()) {
                return false;
            }
        }
        // If any visible tile for this layer's source uses a dynamic
        // image (one with a render callback), the layer's visual content
        // may change every frame.
        if (imageManager.dynamicImageUpdatedThisFrame && layer.source && tileManagers[layer.source]) {
            const coords = tileManagers[layer.source].getVisibleCoordinates(false);
            for (const coord of coords) {
                const tile = tileManagers[layer.source].getTile(coord);
                if (tile?.imageAtlas?.haveRenderCallbacks?.length > 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Returns true if any visible layer has an active paint transition
     * (e.g. from setPaintProperty). Uses hasActiveTransition(now) instead
     * of hasTransition() to ignore expired transitions whose prior
     * reference hasn't been cleared yet.
     */
    _hasActiveTransitions(layerIds: string[], layers: {[_: string]: StyleLayer}, zoom: number): boolean {
        const currentTime = now();
        for (const layerId of layerIds) {
            const layer = layers[layerId];
            if (!layer.isHidden(zoom) && layer.hasActiveTransition(currentTime)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Determine how the translucent pass should be rendered: from cache,
     * with a snapshot to build the cache, or normally.
     */
    prepareTranslucentPass(
        painter: Painter,
        layerIds: string[],
        layers: {[_: string]: StyleLayer},
        zoom: number,
        options: PainterOptions,
        imageManager: ImageManager,
        tileManagers: {[_: string]: TileManager},
    ): TranslucentPassPlan {
        // Compute N: number of consecutive stable layers from the bottom
        let stableLayerCount = 0;
        if (this.enabled) {
            for (const layerId of layerIds) {
                const layer = layers[layerId];
                if (layer.isHidden(zoom)) {
                    stableLayerCount++;
                    continue;
                }
                if (!this._isLayerStable(layer, imageManager, tileManagers)) {
                    break;
                }
                stableLayerCount++;
            }
        }

        // Invalidate cache during camera movement.
        // Note: dynamic image updates don't invalidate the cache because the
        // per-layer check above already excludes layers with dynamic images
        // from the stable set — the cached layers are guaranteed static.
        const cameraMoving = options.moving || options.zooming || options.rotating;
        if (cameraMoving || painter.symbolsAreFading) {
            this._cachedLayerCount = 0;
        }

        // The snapshot captures the opaque pass content for ALL layers.
        // If any layer has an active paint transition (e.g. from setPaintProperty),
        // the opaque pass is mid-transition and the snapshot would be stale.
        // Don't build or reuse a cache while transitions are active.
        const hasActiveTransition = this._hasActiveTransitions(layerIds, layers, zoom);

        // Check if existing cache is still valid
        const cacheValid = this._cachedLayerCount > 0 &&
            !hasActiveTransition &&
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
        } else if (!cameraMoving && !hasActiveTransition && stableLayerCount >= this.minLayers) {
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
    snapshot(context: Context, width: number, height: number, layerCount: number): void {
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
        this._texture?.destroy();
        this._texture = null;
    }
}
