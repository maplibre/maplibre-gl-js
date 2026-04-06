import type {Drawable} from './drawable';
import type {Painter} from '../render/painter';
import type {StyleLayer} from '../style/style_layer';
import type {OverscaledTileID} from '../tile/tile_id';
import type {UniformBlock} from './uniform_block';

/**
 * Base class for per-frame uniform updaters.
 * Each layer type implements a tweaker that updates UBOs
 * for its drawables each frame (matrices, interpolation factors, etc.).
 */
export abstract class LayerTweaker {
    layerId: string;
    evaluatedPropsUBO: UniformBlock | null;
    propertiesUpdated: boolean;

    constructor(layerId: string) {
        this.layerId = layerId;
        this.evaluatedPropsUBO = null;
        this.propertiesUpdated = true;
    }

    /**
     * Called once per frame. Updates layer-level UBO (if properties changed)
     * and per-drawable UBOs (matrix, interpolation factors).
     */
    abstract execute(
        drawables: Drawable[],
        painter: Painter,
        layer: StyleLayer,
        coords: Array<OverscaledTileID>
    ): void;

    destroy(): void {
        if (this.evaluatedPropsUBO) {
            this.evaluatedPropsUBO.destroy();
            this.evaluatedPropsUBO = null;
        }
    }
}
