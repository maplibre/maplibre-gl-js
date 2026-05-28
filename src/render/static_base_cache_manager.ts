import {now} from '../util/time_control.ts';
import {StaticBaseCache} from './static_base_cache.ts';

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
    /** Whether to call {@link StaticBaseCacheManager.captureCache} after rendering layer `stableLayerCount - 1`. */
    needsCapture: boolean;
    /** Number of consecutive stable layers from the bottom. */
    stableLayerCount: number;
};

/**
 * Manages the static base cache by deciding which layers are cacheable,
 * when to capture or reuse cached content, and when to invalidate.
 */
export class StaticBaseCacheManager {
    _cache: StaticBaseCache = new StaticBaseCache();
    enabled: boolean = true;
    stabilityThreshold: number = 3;
    minLayers: number = 5;

    /**
     * Check whether a visible layer is cacheable.
     * Returns false if the layer is custom, recently changed, has a source
     * with active transitions or incomplete tiles, or uses dynamic images.
     */
    _isLayerCacheable(layer: StyleLayer, imageManager: ImageManager, tileManagers: {[_: string]: TileManager}): boolean {
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
            // Don't cache layers whose tiles are still loading —
            // the cache would capture incomplete content (e.g. missing symbols).
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
     * with a capture to build the cache, or normally.
     */
    planTranslucentPassCaching(
        painter: Painter,
        layerIds: string[],
        layers: {[_: string]: StyleLayer},
        zoom: number,
        options: PainterOptions,
        imageManager: ImageManager,
        tileManagers: {[_: string]: TileManager},
    ): TranslucentPassPlan {
        const cache = this._cache;

        // Compute N: number of consecutive stable layers from the bottom
        let stableLayerCount = 0;
        if (this.enabled) {
            for (const layerId of layerIds) {
                const layer = layers[layerId];
                if (layer.isHidden(zoom)) {
                    stableLayerCount++;
                    continue;
                }
                if (!this._isLayerCacheable(layer, imageManager, tileManagers)) {
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
            cache._cachedLayerCount = 0;
        }

        // The cache captures the opaque pass content for ALL layers.
        // If any layer has an active paint transition (e.g. from setPaintProperty),
        // the opaque pass is mid-transition and the cache would be stale.
        // Don't build or reuse a cache while transitions are active.
        const hasActiveTransition = this._hasActiveTransitions(layerIds, layers, zoom);

        // Check if existing cache is still valid
        const cacheValid = cache._cachedLayerCount > 0 &&
            !hasActiveTransition &&
            stableLayerCount >= cache._cachedLayerCount &&
            cache._width === painter.width &&
            cache._height === painter.height;

        let cacheStartLayer = 0;
        let needsCapture = false;

        if (cacheValid) {
            // Reuse existing cache — blit cached texture then skip to remaining layers
            cache._blitCacheToScreen(painter);
            painter.clearStencil();
            cacheStartLayer = cache._cachedLayerCount;
        } else if (!cameraMoving && !hasActiveTransition && stableLayerCount >= this.minLayers) {
            // Will render these layers normally, then capture the screen
            needsCapture = true;
            cache._cachedLayerCount = 0;
        } else {
            // Not enough stable layers or camera moving — no caching
            cache._cachedLayerCount = 0;
        }

        return {cacheStartLayer, needsCapture, stableLayerCount};
    }

    captureCache(context: Context, width: number, height: number, layerCount: number): void {
        this._cache.captureCache(context, width, height, layerCount);
    }

    invalidate(): void {
        this._cache.invalidate();
    }

    destroy(): void {
        this._cache.destroy();
    }
}
